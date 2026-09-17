FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# vite bakes this into the build, it can't be set at container runtime.
# the mapbox token deliberately isn't here, the api serves it to signed in users
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
# nginx's own entrypoint runs envsubst on templates/*.template into conf.d/*.conf at startup,
# substituting only names that are actually set in the container's env (so nginx's own
# $host/$uri/etc are left alone, only ${DOMAIN} gets filled in)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80 443
