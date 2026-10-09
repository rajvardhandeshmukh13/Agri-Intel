FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure model is trained if not already present
RUN python -c "import os; from train import train_and_save; train_and_save() if not os.path.exists('models/yield_model.pkl') else None"
RUN python -c "import os; from train_price import train_and_save; train_and_save() if not os.path.exists('models/price_model.pkl') else None"

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
