FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

RUN npm install

# Copy the rest of your service code
COPY . .

EXPOSE 3003

CMD ["npm", "start"]