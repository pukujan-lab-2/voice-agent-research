# The speech gateway (demo/live-site/speech/gateway). Its code and routes.toml are mounted from the deployed checkout, so
# a routes change applies without a rebuild; only a new dependency needs one.
FROM python:3.12-slim
RUN pip install --no-cache-dir aiohttp==3.14.5
WORKDIR /gateway
CMD ["python", "gateway.py", "--routes", "routes.toml"]
