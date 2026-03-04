@echo off
set "src=c:\Users\Poorav Choudhary\Desktop\irrgation and yield prediction models original\irrgation and yield model predictor"
set "dst=c:\Users\Poorav Choudhary\Desktop\cropy5\rag"

echo Copying models from %src% to %dst%

copy /y "%src%\irrigation_model_3.0.pkl" "%dst%\"
copy /y "%src%\scaler_irrigation.pkl" "%dst%\"
copy /y "%src%\crop_yield_model.pkl" "%dst%\"
copy /y "%src%\scaler_yield.pkl" "%dst%\"

echo Migration finished. Content of %dst%:
dir "%dst%\*.pkl"
