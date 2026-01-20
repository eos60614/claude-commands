# /ml-predict Command

Run ML model inference with support for multiple backends.

## When to Invoke

Consider invoking `/ml-predict` when:
- User wants to run predictions with a trained model
- User asks about model inference
- Testing a machine learning model

## Usage

```
/ml-predict model=<path> input=<data> [backend=auto] [output_format=json]
```

## Arguments

- `model` - Path to the model file (required)
- `input` - Input data as JSON string or file path (required)
- `backend` - ML backend: `auto`, `sklearn`, `torch`, `onnx` (default: `auto`)
- `output_format` - Output format: `json`, `table`, `raw` (default: `json`)

## Examples

```bash
# scikit-learn model
/ml-predict model=model.pkl input="[[1.0, 2.0, 3.0, 4.0]]"

# PyTorch model
/ml-predict model=model.pt input=data.json backend=torch

# ONNX model with table output
/ml-predict model=model.onnx input="[0.5, 0.3, 0.2]" output_format=table
```

## Supported Backends

### scikit-learn (`sklearn`)
- File extensions: `.pkl`, `.joblib`
- Requires: `scikit-learn`, `joblib`
- Supports: `predict()`, `predict_proba()`

### PyTorch (`torch`)
- File extensions: `.pt`, `.pth`
- Requires: `torch`
- Models loaded with `torch.load()`

### ONNX (`onnx`)
- File extensions: `.onnx`
- Requires: `onnxruntime`
- Cross-platform inference

## Input Formats

- **JSON array**: `[[1.0, 2.0, 3.0]]` for feature vectors
- **JSON file**: Path to a JSON file with input data
- **Single value**: `0.5` for single-feature models

## Output

The command returns:
- Model information (path, type, backend)
- Predictions in requested format
- Probabilities (if model supports `predict_proba`)

## Self-Invocation

This command is NOT self-invokable as model inference is typically an explicit user request.
