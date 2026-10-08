FROM node:22.16.0-bookworm-slim
WORKDIR /srv/corner
COPY . .
RUN node --version && node --no-warnings --test tests/*.test.mjs
RUN mkdir -p /data && chown -R node:node /srv/corner /data
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4141
ENV DATA_DIR=/data
ENV CORNER_BASE_PATH=/corner
ENV SITE_URL=https://vamsimarripudi.me/corner
EXPOSE 4141
# Fix persistent volume ownership before dropping privileges.
CMD ["sh", "-c", "chown node:node /data && exec su -s /bin/sh node -c 'node --no-warnings src/server.mjs'"]
