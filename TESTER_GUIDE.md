# Quick Setup Guide for Testers

## 🎯 Goal
Test the Solution One attendance app on your phone

## 📋 What You Need
1. Android phone
2. Same Wi-Fi network as the backend server
3. The APK file OR Expo Go app

---

## 🚀 Setup Steps

### Step 1: Install the App

**Option A: Using APK (Standalone)**
1. Download the APK file sent to you
2. Open the file on your phone
3. Allow installation from unknown sources if prompted
4. Install the app

**Option B: Using Expo Go (Testing)**
1. Install "Expo Go" from Play Store
2. Scan the QR code provided
3. App will load in Expo Go

### Step 2: Connect to Same Wi-Fi
- Make sure your phone is connected to the **same Wi-Fi network** as the server
- Ask the admin for the network name

### Step 3: Update Backend URL (If Needed)

If the app shows "Network Error":
1. Ask admin for the **backend server IP address**
2. Example: `192.168.1.5`

**For APK users:** Contact admin to update the app with correct IP

**For Expo Go users:** Admin will update and you'll need to refresh

---

## 🧪 Test Accounts

### Login as Admin
- **Email:** admin@solutionone.com  
- **Password:** admin123

**What you can do:**
- View all employees
- See attendance records
- Monitor check-ins/check-outs

### Login as Employee
- **Email:** employee1@solutionone.com  
- **Password:** emp123

**What you can do:**
- Check-in (must be within 50m of office)
- Check-out
- View your attendance status

---

## ✅ Testing Checklist

- [ ] App opens successfully
- [ ] Can login with admin credentials
- [ ] Can see employee list (admin view)
- [ ] Can logout
- [ ] Can login with employee credentials
- [ ] Can see check-in button
- [ ] Can check-in (if within geofence)
- [ ] Can check-out
- [ ] Can see attendance status

---

## ❌ Common Issues

### "Network Error"
- **Solution:** Check Wi-Fi connection, ensure you're on same network as server

### "You are too far from office"
- **Solution:** This is geofencing working! You must be within 50m of office
- For testing: Ask admin to temporarily increase geofence radius

### "Invalid credentials"
- **Solution:** Double-check email and password spelling

### App crashes
- **Solution:** Close and reopen, or reinstall the app

---

## 📝 Feedback

Please report:
- ✅ What works well
- ❌ What doesn't work
- 💡 Suggestions for improvement

Send feedback to: [Your Email]

---

## ⏱️ Server Availability

**Important:** The backend server must be running for the app to work!

- **Server Status:** Check with admin
- **Server Hours:** [Specify when server will be online]

---

Thank you for testing! 🙏
