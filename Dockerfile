FROM node:5.2.0

COPY ./src /usr/src/app

WORKDIR /usr/src/app
ENTRYPOINT ["node"]
CMD ["index.js"]
