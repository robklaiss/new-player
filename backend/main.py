from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import sqlite3
import json
import os
import shutil
from datetime import datetime

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
app.mount("/files", StaticFiles(directory="files"), name="files")

# Database initialization
def init_db():
    conn = sqlite3.connect('devices.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS devices (
            device_id TEXT PRIMARY KEY,
            last_seen TEXT,
            system_info TEXT,
            content_info TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

class PingData(BaseModel):
    device_id: str
    timestamp: str
    system_info: Dict
    content_info: Dict

class UpdateResponse(BaseModel):
    updates: List[Dict]

@app.post("/api/ping")
async def ping(data: PingData):
    conn = sqlite3.connect('devices.db')
    c = conn.cursor()
    
    # Update device info
    c.execute('''
        INSERT OR REPLACE INTO devices (device_id, last_seen, system_info, content_info)
        VALUES (?, ?, ?, ?)
    ''', (
        data.device_id,
        data.timestamp,
        json.dumps(data.system_info),
        json.dumps(data.content_info)
    ))
    
    # Check for updates
    updates = []
    content_dir = "files"
    device_files = data.content_info
    
    for filename in os.listdir(content_dir):
        file_path = os.path.join(content_dir, filename)
        if os.path.isfile(file_path):
            # If file doesn't exist on device or has different size
            if filename not in device_files:
                updates.append({
                    "filename": filename,
                    "url": f"/files/{filename}"
                })
    
    conn.commit()
    conn.close()
    
    return UpdateResponse(updates=updates)

@app.get("/api/devices")
async def get_devices():
    conn = sqlite3.connect('devices.db')
    c = conn.cursor()
    c.execute('SELECT * FROM devices')
    devices = []
    for row in c.fetchall():
        devices.append({
            "device_id": row[0],
            "last_seen": row[1],
            "system_info": json.loads(row[2]),
            "content_info": json.loads(row[3])
        })
    conn.close()
    return devices

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_path = os.path.join("files", file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
