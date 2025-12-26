# Use a lightweight Python image
FROM python:3.9-slim

# Set the working directory
WORKDIR /app

# Copy the server script and the application files
COPY server.py .
COPY standalone.html .
COPY babel.min.js .
COPY tailwindcss.js .

# Expose the port the server runs on
EXPOSE 8000

# Run the secure python server with unbuffered output
CMD ["python", "-u", "server.py"]
