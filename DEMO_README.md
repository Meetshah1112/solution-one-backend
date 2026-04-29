# Solution One - Office Attendance App (DEMO VERSION)

## 📱 About This Demo

This is a **local demo version** of Solution One - an office attendance management system with geofencing capabilities.

### ⚠️ DEMO LIMITATIONS

This demo version requires:
- **Backend server running on a local computer** (not yet deployed to cloud)
- **Same Wi-Fi network** for phone and backend server
- The server computer must be turned on and running the backend

**Full cloud deployment (AWS) will be available once AWS account activation is complete.**

---

## 🚀 How to Test This Demo

### For Testers (Non-Technical)

1. **Install the APK** on your Android phone
2. **Make sure you're connected to the same Wi-Fi** as the backend server
3. **Use these test accounts:**

   **Admin Account:**
   - Email: `admin@solutionone.com`
   - Password: `admin123`

   **Employee Accounts:**
   - Email: `employee1@solutionone.com` | Password: `emp123`
   - Email: `employee2@solutionone.com` | Password: `emp123`
   - Email: `employee3@solutionone.com` | Password: `emp123`

### For Backend Setup (Technical)

**Prerequisites:**
- Node.js installed
- MySQL installed and running

**Steps:**

1. **Start MySQL:**
   - Open MySQL Workbench
   - Connect to local instance

2. **Start Backend Server:**
   ```bash
   cd backend
   node server.js
   ```
   
   You should see:
   ```
   ✅ Server running on http://localhost:3000
   📍 Office Location: 22.3072, 73.1812
   📏 Geofence Radius: 50 meters
   ```

3. **Keep this terminal window open** while testing

4. **Share your computer's IP address** with testers so they can update the app

---

## ✨ Features

### Employee Features:
- ✅ Login with email/password
- ✅ Check-in with geofencing (must be within 50m of office)
- ✅ Check-out tracking
- ✅ View attendance status
- ✅ Real-time location verification

### Admin Features:
- ✅ View all employees
- ✅ Monitor attendance records
- ✅ Track check-in/check-out times
- ✅ View individual employee details
- ✅ Access attendance history

---

## 🔧 Configuration

### Updating Backend URL (For Testers)

If you're testing on a physical device:

1. Get the backend server's IP address from your network admin
2. Edit `src/services/api.ts`
3. Change:
   ```typescript
   const API_BASE_URL = 'http://localhost:3000/api';
   ```
   To:
   ```typescript
   const API_BASE_URL = 'http://YOUR_COMPUTER_IP:3000/api';
   ```
   Example: `http://192.168.1.5:3000/api`

### Updating Office Location (Geofence)

Edit `backend/.env`:
```env
OFFICE_LATITUDE=22.3072
OFFICE_LONGITUDE=73.1812
GEOFENCE_RADIUS=50
```

---

## 📊 Database Schema

### Users Table
- id (Primary Key)
- email
- password
- name
- role (employee/admin)
- created_at

### Attendance Table
- id (Primary Key)
- user_id (Foreign Key)
- check_in_time
- check_out_time
- latitude
- longitude
- status (present/absent/late)
- date
- created_at

---

## 🐛 Troubleshooting

### "Network Error" when logging in
- Ensure backend server is running
- Check if phone and computer are on same Wi-Fi
- Verify backend URL in `api.ts` matches your computer's IP

### "You are too far from office"
- Geofence is set to 50 meters radius
- Update office coordinates in `backend/.env` to your actual location
- Or temporarily increase `GEOFENCE_RADIUS` for testing

### Backend server crashes
- Check MySQL is running
- Verify database credentials in `backend/.env`
- Check console for error messages

---

## 🔜 Coming Soon (After AWS Activation)

- ☁️ Cloud deployment (AWS)
- 🌐 Accessible from anywhere (no need for same Wi-Fi)
- 📈 Production-ready hosting
- 🔒 Enhanced security
- 📧 Email notifications
- 📊 Advanced analytics

---

## 📞 Support

For issues or questions:
- Contact: [Your Email]
- Documentation: [Link to docs]

---

## 📝 Version Info

- **Version:** 1.0.0 (Demo)
- **Build Date:** January 2026
- **Status:** Local Development Demo
- **Platform:** Android (APK)

---

**Note:** This is a demonstration version for testing and feedback. The production version will be deployed to AWS cloud services for 24/7 availability.
