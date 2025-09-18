const express = require('express');
const app = express();
const port = 5007;
const sellerController = require('./controllers/sellerController');

app.use(express.json());

// Seller Profiles
app.get('/seller/:userId/profile', sellerController.getSellerProfile);
app.post('/seller/:userId/profile', sellerController.createSellerProfile);
app.put('/seller/:userId/profile', sellerController.updateSellerProfile);

// ✅ Onboarding complete
app.put('/seller/:userId/onboarding-complete', sellerController.markOnboardingComplete);

// Plans
app.get('/plans', sellerController.getAllPlans);

// Subscriptions
app.get('/seller/:userId/subscription', sellerController.getSubscription);
app.post('/seller/:userId/subscription', sellerController.createSubscription);
app.put('/seller/:userId/subscription', sellerController.updateSubscription);

// Payments
app.get('/payment/:paymentId', sellerController.getPayment);
app.post('/payment', sellerController.createPayment);

app.listen(port, () => {
  console.log(`Seller service listening at http://localhost:${port}`);
});
