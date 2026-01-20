"""
/ml-predict - Run ML model inference
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
import json
import os


@dataclass
class CommandConfig:
    name: str
    description: str
    args: Optional[List[dict]] = None
    self_invokable: bool = False
    triggers: Optional[List[str]] = None


@dataclass
class CommandResult:
    success: bool
    output: str
    error: Optional[str] = None


config = CommandConfig(
    name="ml-predict",
    description="Run ML model inference with various backends",
    args=[
        {
            "name": "model",
            "description": "Model name or path",
            "type": "string",
            "required": True,
        },
        {
            "name": "input",
            "description": "Input data (JSON string or file path)",
            "type": "string",
            "required": True,
        },
        {
            "name": "backend",
            "description": "ML backend (auto, sklearn, torch, onnx)",
            "type": "string",
            "required": False,
            "default": "auto",
        },
        {
            "name": "output_format",
            "description": "Output format (json, table, raw)",
            "type": "string",
            "required": False,
            "default": "json",
        },
    ],
    self_invokable=False,
    triggers=[],
)


def detect_backend(model_path: str) -> str:
    """Detect ML backend from model file extension."""
    ext = os.path.splitext(model_path)[1].lower()

    if ext in [".pkl", ".joblib"]:
        return "sklearn"
    elif ext in [".pt", ".pth"]:
        return "torch"
    elif ext == ".onnx":
        return "onnx"
    elif ext in [".h5", ".keras"]:
        return "keras"
    else:
        return "unknown"


def load_input_data(input_str: str) -> Any:
    """Load input data from JSON string or file."""
    # Try as JSON first
    try:
        return json.loads(input_str)
    except json.JSONDecodeError:
        pass

    # Try as file path
    if os.path.isfile(input_str):
        with open(input_str, "r") as f:
            content = f.read()
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # Return raw content for text models
                return content

    return input_str


def format_predictions(predictions: Any, output_format: str) -> str:
    """Format predictions based on output format."""
    if output_format == "raw":
        return str(predictions)

    if output_format == "table":
        if isinstance(predictions, list):
            lines = ["| Index | Prediction |", "|-------|------------|"]
            for i, pred in enumerate(predictions):
                lines.append(f"| {i} | {pred} |")
            return "\n".join(lines)
        elif isinstance(predictions, dict):
            lines = ["| Key | Value |", "|-----|-------|"]
            for key, value in predictions.items():
                lines.append(f"| {key} | {value} |")
            return "\n".join(lines)

    # Default to JSON
    return json.dumps(predictions, indent=2, default=str)


async def run_sklearn_inference(model_path: str, input_data: Any) -> Dict[str, Any]:
    """Run inference with scikit-learn model."""
    try:
        import joblib
        import numpy as np
    except ImportError:
        return {
            "success": False,
            "error": "scikit-learn or joblib not installed. Run: pip install scikit-learn joblib",
        }

    try:
        model = joblib.load(model_path)

        # Convert input to numpy array
        if isinstance(input_data, list):
            X = np.array(input_data)
            if X.ndim == 1:
                X = X.reshape(1, -1)
        else:
            X = np.array([[input_data]])

        predictions = model.predict(X)

        # Get probabilities if available
        proba = None
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X).tolist()

        return {
            "success": True,
            "predictions": predictions.tolist(),
            "probabilities": proba,
            "model_type": type(model).__name__,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def run_torch_inference(model_path: str, input_data: Any) -> Dict[str, Any]:
    """Run inference with PyTorch model."""
    try:
        import torch
    except ImportError:
        return {
            "success": False,
            "error": "PyTorch not installed. Run: pip install torch",
        }

    try:
        model = torch.load(model_path, map_location="cpu")
        model.eval()

        # Convert input to tensor
        if isinstance(input_data, list):
            X = torch.tensor(input_data, dtype=torch.float32)
            if X.dim() == 1:
                X = X.unsqueeze(0)
        else:
            X = torch.tensor([[input_data]], dtype=torch.float32)

        with torch.no_grad():
            output = model(X)

        predictions = output.numpy().tolist()

        return {
            "success": True,
            "predictions": predictions,
            "model_type": type(model).__name__,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def run_onnx_inference(model_path: str, input_data: Any) -> Dict[str, Any]:
    """Run inference with ONNX model."""
    try:
        import onnxruntime as ort
        import numpy as np
    except ImportError:
        return {
            "success": False,
            "error": "ONNX Runtime not installed. Run: pip install onnxruntime",
        }

    try:
        session = ort.InferenceSession(model_path)

        # Get input name
        input_name = session.get_inputs()[0].name

        # Convert input to numpy array
        if isinstance(input_data, list):
            X = np.array(input_data, dtype=np.float32)
            if X.ndim == 1:
                X = X.reshape(1, -1)
        else:
            X = np.array([[input_data]], dtype=np.float32)

        outputs = session.run(None, {input_name: X})

        return {
            "success": True,
            "predictions": [o.tolist() for o in outputs],
            "model_type": "ONNX",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def execute(args: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> CommandResult:
    """Execute the ml-predict command."""
    model_path = args.get("model", "")
    input_str = args.get("input", "")
    backend = args.get("backend", "auto")
    output_format = args.get("output_format", "json")

    if not model_path:
        return CommandResult(
            success=False,
            output="",
            error="Model path is required",
        )

    if not input_str:
        return CommandResult(
            success=False,
            output="",
            error="Input data is required",
        )

    cwd = context.get("cwd", os.getcwd()) if context else os.getcwd()

    # Resolve model path
    if not os.path.isabs(model_path):
        model_path = os.path.join(cwd, model_path)

    if not os.path.isfile(model_path):
        return CommandResult(
            success=False,
            output="",
            error=f"Model file not found: {model_path}",
        )

    # Load input data
    input_data = load_input_data(input_str)

    # Detect or validate backend
    if backend == "auto":
        backend = detect_backend(model_path)
        if backend == "unknown":
            return CommandResult(
                success=False,
                output="",
                error="Could not detect model backend. Please specify backend explicitly.",
            )

    # Run inference
    if backend == "sklearn":
        result = await run_sklearn_inference(model_path, input_data)
    elif backend == "torch":
        result = await run_torch_inference(model_path, input_data)
    elif backend == "onnx":
        result = await run_onnx_inference(model_path, input_data)
    else:
        return CommandResult(
            success=False,
            output="",
            error=f"Unsupported backend: {backend}. Supported: sklearn, torch, onnx",
        )

    if not result.get("success"):
        return CommandResult(
            success=False,
            output="",
            error=result.get("error", "Inference failed"),
        )

    # Format output
    output_lines = [
        "# ML Prediction Results",
        "",
        f"**Model:** {os.path.basename(model_path)}",
        f"**Backend:** {backend}",
        f"**Model Type:** {result.get('model_type', 'Unknown')}",
        "",
        "## Predictions",
        "",
        format_predictions(result.get("predictions"), output_format),
    ]

    if result.get("probabilities"):
        output_lines.extend([
            "",
            "## Probabilities",
            "",
            format_predictions(result.get("probabilities"), output_format),
        ])

    return CommandResult(
        success=True,
        output="\n".join(output_lines),
    )
