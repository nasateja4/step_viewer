from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import shutil
import os
import cadquery as cq
import uuid

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/convert")
async def convert_step(file: UploadFile = File(...)):
    try:
        # Save uploaded file
        file_id = str(uuid.uuid4())
        input_filename = f"{file_id}_{file.filename}"
        input_path = os.path.join(UPLOAD_DIR, input_filename)
        
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Convert to GLB (using STL as intermediate if needed, or direct export if supported)
        # CadQuery can export to STL. We'll use STL for simplicity as Three.js handles it well.
        # Or better, GLTF/GLB if CadQuery supports it well via assembly.
        
        output_filename = f"{file_id}.stl"
        output_path = os.path.join(UPLOAD_DIR, output_filename)
        
        # Load and Export
        # Note: This is a basic import. Complex assemblies might need more handling.
        model = cq.importers.importStep(input_path)
        cq.exporters.export(model, output_path)
        
        # Cleanup input
        os.remove(input_path)
        
        return FileResponse(output_path, filename="converted.stl")

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"status": "ok", "message": "STEP Converter API Ready"}
