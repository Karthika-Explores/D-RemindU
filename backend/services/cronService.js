const cron = require("node-cron");
const webpush = require("web-push");
const Medication = require("../models/Medication");
const User = require("../models/User");

// Configure web-push
webpush.setVapidDetails(
  "mailto:example@yourdomain.org",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const startCronJobs = () => {
  // Run every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      // Get current local server time in HH:mm format
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeString = `${currentHours}:${currentMinutes}`;
      
      console.log(`[Cron] Checking medications for time: ${currentTimeString}`);

      const medications = await Medication.find({});
      
      for (const med of medications) {
        if (!med.reminderTime) continue;

        // reminderTime is usually a comma-separated list like "08:00, 14:00"
        const times = med.reminderTime.split(",").map(t => t.trim());
        
        let triggerTime = false;
        if (times.includes(currentTimeString)) triggerTime = true;

        if (triggerTime) {
          // Time matches, find user
          const user = await User.findById(med.userId);
          if (user && user.pushSubscriptions && user.pushSubscriptions.length > 0) {
            const payload = JSON.stringify({
              title: "Time for Medication 💊",
              body: `It's time to take your ${med.medicineName} (${med.dosage}).`,
              url: "/dashboard"
            });

            // Send notification to all of the user's registered devices
            const failedIndices = [];
            for (let i = 0; i < user.pushSubscriptions.length; i++) {
              const sub = user.pushSubscriptions[i];
              try {
                await webpush.sendNotification(sub, payload);
              } catch (err) {
                console.error("Failed pushing to a subscriber:", err.statusCode);
                if (err.statusCode === 410 || err.statusCode === 404) {
                  failedIndices.push(i);
                }
              }
            }

            // Clean up gone/expired subscriptions
            if (failedIndices.length > 0) {
              user.pushSubscriptions = user.pushSubscriptions.filter((_, idx) => !failedIndices.includes(idx));
              await user.save();
            }
          }
        }
      }
    } catch (error) {
      console.error("[Cron] Error processing scheduled push notifications:", error);
    }
  });
  
  console.log("Push notification cron service started.");
};

module.exports = { startCronJobs };
