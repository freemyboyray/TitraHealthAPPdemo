FROM denoland/deno:latest

WORKDIR /app

COPY index.ts .

EXPOSE 8080

CMD ["deno", "run", "--allow-net", "--allow-env", "index.ts"]
