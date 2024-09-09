const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cookies = "_ga=GA1.1.2120117660.1722196509; _ga_9YKJW15D56=GS1.1.1723197248.8.0.1723197251.0.0.0; crisp-client%2Fsession%2Fae41150c-fed2-46d0-8016-7fe02b4760fa=session_3553698c-4ce3-4ae3-9f63-22b4192b55c6; crisp-client%2Fsocket%2Fae41150c-fed2-46d0-8016-7fe02b4760fa=0";
const app = express();
const port = 3000;

let tasks = {};
let completedTasks = [];
let totalTasksToday = 0;
let taskHistory = [];

const formatErrorResponse = (error) => {
  return {
    status: 'error',
    message: error.response ? error.response.data : error.message,
  };
};

async function uploadImage(imagePath) {
  const form = new FormData(); // Create a new instance of FormData
  form.append('file', fs.createReadStream(imagePath)); // Add file stream to form

  try {
    const response = await axios.post('https://aifaceswap.io/api/upload_img', form, {
      headers: form.getHeaders(), // Use form-data's getHeaders method
    });
    return response.data.data;
  } catch (error) {
    throw formatErrorResponse(error);
  }
}

async function generateFaceSwap(sourceImageUrl, faceImageUrl) {
  const data = {
    source_image: sourceImageUrl,
    face_image: faceImageUrl,
  };

  try {
    const response = await axios.post('https://aifaceswap.io/api/generate_face', data, {
      headers: {
              "accept": "application/json, text/plain, */*",
              "accept-language": "en-US,en;q=0.9",
              "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MjU5NzcyNjAsInN1YiI6Imdvb2dsZSAxNTU4NCB0d3JpYWQ5NkBnbWFpbC5jb20ifQ.VPpQxNVWslJtsXyiWUFpRojNtGtJ5lDCg9yOcEE9P2M",
              "cache-control": "no-cache",
              "content-type": "application/json",
              "pragma": "no-cache",
              "priority": "u=1, i",
              "sec-ch-ua": "\"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\", \"Google Chrome\";v=\"128\"",
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": "\"Windows\"",
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin",
              "x-code": "1725912783941",
              "x-fp": "92e9a897c24996744646b8b6b69761a5",
              "cookie": "_ga=GA1.1.2120117660.1722196509; crisp-client%2Fsession%2Fae41150c-fed2-46d0-8016-7fe02b4760fa=session_3553698c-4ce3-4ae3-9f63-22b4192b55c6; g_state={\"i_l\":0}; _ga_9YKJW15D56=GS1.1.1725912422.9.0.1725912422.0.0.0",
              "Referer": "https://aifaceswap.io/",
              "Referrer-Policy": "strict-origin-when-cross-origin"
            },
    });
    return response.data.data.task_id;
  } catch (error) {
    throw formatErrorResponse(error);
  }
}

async function checkStatus(taskId) {
  const data = { task_id: taskId };

  try {
    const response = await axios.post('https://aifaceswap.io/api/check_status', data, {
      headers: {
        'content-type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    throw formatErrorResponse(error);
  }
}

async function processImages(targetImagePath, faceImagePath) {
  try {
    console.log('Uploading target image...');
    const targetImageUrl = await uploadImage(targetImagePath);
    console.log('Target image uploaded:', targetImageUrl);

    console.log('Uploading face image...');
    const faceImageUrl = await uploadImage(faceImagePath);
    console.log('Face image uploaded:', faceImageUrl);

    console.log('Generating face swap...');
    const taskId = await generateFaceSwap(targetImageUrl, faceImageUrl);
    console.log('Face generation task ID:', taskId);

    const startTime = Date.now();
    tasks[taskId] = {
      task_id: taskId,
      status: 'Processing',
      startTime,
      source_image: targetImageUrl,
      face_image: faceImageUrl,
    };

    totalTasksToday++;
    taskHistory.push(startTime);

    let statusResponse;
    do {
      console.log('Checking status...');
      statusResponse = await checkStatus(taskId);
      if (statusResponse.data.status === 2) {
        tasks[taskId].status = 'Completed';
        tasks[taskId].result_image = statusResponse.data.result_image;
        completedTasks.push(tasks[taskId]);
        delete tasks[taskId];
      } else {
        tasks[taskId].status = 'Processing';
      }
      console.log('Current status:', statusResponse);

      if (statusResponse.data.status !== 2) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } while (statusResponse.data.status !== 2);

    console.log('Final status:', statusResponse);
    return statusResponse;
  } catch (error) {
    console.error('Error processing images:', error.message);
    throw error;
  }
}

function calculateStats() {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const oneMinuteAgo = now - 60000;

  const lastHourCount = taskHistory.filter((timestamp) => timestamp >= oneHourAgo).length;
  const lastMinuteCount = taskHistory.filter((timestamp) => timestamp >= oneMinuteAgo).length;

  return {
    running: Object.keys(tasks).length,
    totalToday: totalTasksToday,
    lastHour: lastHourCount,
    lastMinute: lastMinuteCount,
  };
}

app.get('/process', async (req, res) => {
  const { targetImageUrl, faceImageUrl } = req.query;

  if (!targetImageUrl || !faceImageUrl) {
    return res.status(400).json({ status: 'error', message: 'Both targetImageUrl and faceImageUrl are required.' });
  }

  try {
    const targetImageName = `${uuidv4()}.jpg`;
    const faceImageName = `${uuidv4()}.jpg`;

    const targetImagePath = path.join(__dirname, targetImageName);
    const faceImagePath = path.join(__dirname, faceImageName);

    const downloadImage = async (url, filepath) => {
      const response = await axios({
        url,
        responseType: 'stream',
      });
      return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath)).on('finish', resolve).on('error', reject);
      });
    };

    await downloadImage(targetImageUrl, targetImagePath);
    await downloadImage(faceImageUrl, faceImagePath);

    const statusResponse = await processImages(targetImagePath, faceImagePath);
    res.json(statusResponse);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/status', async (req, res) => {
  try {
    const stats = calculateStats();
    const runningTasks = Object.values(tasks);
    const oldTasks = completedTasks;

    res.json({ stats, runningTasks, oldTasks });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
