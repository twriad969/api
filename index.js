const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

let tasks = {};
let completedTasks = [];
let totalTasksToday = 0;
let taskHistory = []; // Store timestamp of task creations for statistics

// Serve the HTML page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Image Processing Status</title>
      <script src="https://cdn.tailwindcss.com/3.4.5"></script>
      <style>
        .skeleton {
          background: linear-gradient(90deg, rgba(165, 165, 165, 0.1) 25%, rgba(165, 165, 165, 0.2) 50%, rgba(165, 165, 165, 0.1) 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
        }

        @keyframes skeleton-loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      </style>
    </head>
    <body class="bg-gray-100 text-gray-800">
      <div class="container mx-auto p-4">
        <h1 class="text-3xl font-bold text-center mb-6 text-blue-700">Image Processing Dashboard</h1>
        <div id="stats" class="bg-white p-4 rounded-lg shadow mb-4">
          <p class="font-bold text-gray-700">Running Tasks: <span id="running-tasks-count">0</span></p>
          <p class="font-bold text-gray-700">Total Tasks Today: <span id="total-tasks-today">0</span></p>
          <p class="font-bold text-gray-700">Tasks in Last Hour: <span id="tasks-last-hour">0</span></p>
          <p class="font-bold text-gray-700">Tasks in Last Minute: <span id="tasks-last-minute">0</span></p>
        </div>
        <div id="status-container" class="space-y-4">
          <div class="skeleton w-full h-24 rounded-lg"></div>
          <div class="skeleton w-full h-24 rounded-lg"></div>
          <div class="skeleton w-full h-24 rounded-lg"></div>
        </div>
        <div id="old-requests" class="space-y-4 mt-8">
          <h2 class="text-xl font-semibold text-gray-700">Old Requests</h2>
          <div class="skeleton w-full h-24 rounded-lg"></div>
          <div class="skeleton w-full h-24 rounded-lg"></div>
          <div class="skeleton w-full h-24 rounded-lg"></div>
        </div>
      </div>
      <script>
        const statusContainer = document.getElementById('status-container');
        const oldRequestsContainer = document.getElementById('old-requests');
        const runningTasksCountElem = document.getElementById('running-tasks-count');
        const totalTasksTodayElem = document.getElementById('total-tasks-today');
        const tasksLastHourElem = document.getElementById('tasks-last-hour');
        const tasksLastMinuteElem = document.getElementById('tasks-last-minute');

        function updateStats(stats) {
          runningTasksCountElem.textContent = stats.running;
          totalTasksTodayElem.textContent = stats.totalToday;
          tasksLastHourElem.textContent = stats.lastHour;
          tasksLastMinuteElem.textContent = stats.lastMinute;
        }

        function createTaskElement(task) {
          return '<div class="bg-white shadow p-4 rounded-lg transition ease-in-out duration-200">' +
                  '<p class="font-medium text-green-600">Task ID: ' + task.task_id + '</p>' +
                  '<p>Status: ' + task.status + '</p>' +
                  '</div>';
        }

        function updateTaskList(container, tasks) {
          container.innerHTML = ''; // Clear previous content
          tasks.forEach(task => {
            container.innerHTML += createTaskElement(task);
          });
        }

        async function fetchStatus() {
          try {
            const response = await fetch('/status');
            const data = await response.json();
            updateStats(data.stats);
            updateTaskList(statusContainer, data.runningTasks);
            updateTaskList(oldRequestsContainer, data.oldTasks);
          } catch (error) {
            console.error('Error fetching status:', error.message);
          }
        }

        document.addEventListener('DOMContentLoaded', () => {
          setInterval(fetchStatus, 1000);
        });
      </script>
    </body>
    </html>
  `);
});

const formatErrorResponse = (error) => {
  return {
    status: 'error',
    message: error.response ? error.response.data : error.message,
  };
};

async function uploadImage(imagePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));

  try {
    const response = await axios.post('https://aifaceswap.io/api/upload_img', form, {
      headers: {
        ...form.getHeaders(),
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      },
    });
    return response.data.data;
  } catch (error) {
    throw formatErrorResponse(error);
  }
}

async function generateFace(sourceImage, faceImage) {
  const data = { source_image: sourceImage, face_image: faceImage };

  try {
    const response = await axios.post('https://aifaceswap.io/api/generate_face', data, {
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
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
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
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
    const taskId = await generateFace(targetImageUrl, faceImageUrl);
    console.log('Face generation task ID:', taskId);

    const startTime = Date.now();
    tasks[taskId] = { task_id: taskId, status: 'Processing', startTime };

    totalTasksToday++;
    taskHistory.push(startTime);

    let statusResponse;
    do {
      console.log('Checking status...');
      statusResponse = await checkStatus(taskId);
      if (statusResponse.data.status === 2) {
        tasks[taskId].status = 'Completed';
        completedTasks.push(tasks[taskId]);
        delete tasks[taskId];
      } else {
        tasks[taskId].status = 'Processing';
      }
      console.log('Current status:', statusResponse);

      if (statusResponse.data.status !== 2) {
        await new Promise(resolve => setTimeout(resolve, 2000));
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

  const lastHourCount = taskHistory.filter(timestamp => timestamp >= oneHourAgo).length;
  const lastMinuteCount = taskHistory.filter(timestamp => timestamp >= oneMinuteAgo).length;

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

    // Download images from URLs
    const downloadImage = async (url, filepath) => {
      const response = await axios({
        url,
        responseType: 'stream',
      });
      return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath))
          .on('finish', resolve)
          .on('error', reject);
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
