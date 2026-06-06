SHELL := /bin/bash
.PHONY: help gate-test pull-model demo up warm prove-boundary logs down nuke

help:            ## show targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | sort

gate-test:       ## does vLLM 0.11 serve Nemotron NVFP4 on the GB10? (run this FIRST)
	docker volume create cb_models >/dev/null
	@echo "Bringing vLLM up — first run downloads ~16GB. Ctrl-C after you've confirmed it serves."
	docker run --rm --gpus all -p 8000:8000 -v cb_models:/models -e HF_HOME=/models \
	  vllm/vllm-openai:v0.11.0 \
	  --model nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4 \
	  --served-model-name nemotron-nano --max-model-len 8192 \
	  --gpu-memory-utilization 0.85 --trust-remote-code

pull-model:      ## pre-stage NVFP4 weights into cb_models so demo-time vllm needs no egress
	docker volume create cb_models >/dev/null
	docker run --rm -v cb_models:/models -e HF_HOME=/models --entrypoint python3 \
	  vllm/vllm-openai:v0.11.0 -c "from huggingface_hub import snapshot_download as d; \
	  d('$${BRAIN_MODEL:-nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4}')"

demo: pull-model up warm  ## one-command bring-up: stage weights, start stack, pre-warm

up:              ## start the whole stack and block until healthchecks pass
	docker compose up -d --build --wait

warm:            ## pre-warm the brain + civic path so there's no cold start on stage
	@docker compose exec -T gateway sh -lc 'curl -s http://vllm:8000/v1/chat/completions \
	  -H "content-type: application/json" \
	  -d "{\"model\":\"nemotron-nano\",\"messages\":[{\"role\":\"user\",\"content\":\"warmup\"}],\"max_tokens\":4}" >/dev/null' \
	  && echo "brain warm ✅" || echo "brain warm FAILED"
	@docker compose exec -T bridge sh -lc 'curl -s -XPOST localhost:8091/ask \
	  -H "content-type: application/json" -d "{\"message\":\"nearest library to 1 Triton Square\"}" >/dev/null' \
	  && echo "civic path warm ✅" || echo "civic warm FAILED"

prove-boundary:  ## show the privacy boundary holding (for judges)
	@echo "1) reasoning core has NO internet route:"
	@docker compose exec -T gateway sh -lc 'curl -m5 -sS https://example.com >/dev/null 2>&1 && echo "   LEAK ❌" || echo "   internet BLOCKED ✅"'
	@echo "2) brain reaches the local model fine (proves it is up, just walled):"
	@docker compose exec -T gateway sh -lc 'curl -m5 -fsS http://vllm:8000/health >/dev/null 2>&1 && echo "   local brain OK ✅" || echo "   brain unreachable ❌"'
	@echo "3) even via the proxy, only ElevenLabs is allowed:"
	@docker compose exec -T bridge sh -lc 'curl -m5 -sS -x http://egress-proxy:8888 https://www.google.com >/dev/null 2>&1 && echo "   LEAK ❌" || echo "   non-ElevenLabs DENIED ✅"'
	@docker compose exec -T bridge sh -lc 'curl -m5 -sS -x http://egress-proxy:8888 -I https://api.elevenlabs.io 2>/dev/null | head -1 || echo "   (elevenlabs check)"'

logs:            ## tail everything (watch egress-proxy for the only outbound traffic)
	docker compose logs -f

down:            ## stop the stack (keep volumes)
	docker compose down

nuke:            ## stop + delete volumes (re-download weights next time)
	docker compose down -v
