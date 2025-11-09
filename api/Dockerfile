FROM node:18-alpine
WORKDIR /app
# servidor mínimo que responde "OK" en el puerto 3000
RUN echo 'const http=require("http");http.createServer((_,res)=>res.end("OK")).listen(3000,"0.0.0.0");' > server.js
EXPOSE 3000
CMD ["node","server.js"]
