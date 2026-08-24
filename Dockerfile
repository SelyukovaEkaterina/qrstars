FROM node:22-alpine
RUN apk add --no-cache libc6-compat curl ttf-dejavu
WORKDIR /app

COPY deploy/certs/russiantrustedca.pem /usr/local/share/qrstars/russian-trusted-ca.pem
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/qrstars/russian-trusted-ca.pem

COPY package.json package-lock.json ./
RUN npm install

COPY . .

ARG NEXT_PUBLIC_BASE_URL=https://app.qrstars.ru
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_VK_CLIENT_ID=54734947
ENV NEXT_PUBLIC_VK_CLIENT_ID=$NEXT_PUBLIC_VK_CLIENT_ID
ARG NEXT_PUBLIC_VK_REDIRECT_URI=https://app.qrstars.ru/auth/vk/callback
ENV NEXT_PUBLIC_VK_REDIRECT_URI=$NEXT_PUBLIC_VK_REDIRECT_URI

RUN npx prisma generate
RUN npm run build

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/entrypoint.sh"]
