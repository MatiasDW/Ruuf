FROM node:26.7-alpine

WORKDIR /app

RUN chown node:node /app

USER node

COPY --chown=node:node frontend/package.json ./package.json
COPY --chown=node:node frontend/package-lock.json ./package-lock.json
RUN npm ci

COPY --chown=node:node frontend/ .

RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
