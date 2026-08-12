# Build lightweight production image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Ensure syllabus PDF is generated
RUN node Gen-AI/GenAI_Project/create_pdf.js

# Expose default port
EXPOSE 4000
ENV PORT=4000
ENV NODE_ENV=production

# Start application server
CMD ["node", "Gen-AI/GenAI_Project/server.js"]
