# Jumbo Commerce

 Live Demo: [https://jumbo-commerce.netlify.app]

A high-performance, responsive e-commerce frontend architecture integrated with real-time analytics and a simulated microservices backend. 

This project demonstrates proficiency in modern web development, state management, and real-time data handling without reliance on heavy CSS frameworks.

---

## Key Features

* **Role-Based Access Control (RBAC) UI**: Distinct interface rendering for standard users (shopping, cart management, checkout) versus administrators (inventory management, system metrics).
* **Real-Time Analytics Dashboard**: Integration with WebSockets (Socket.io) to simulate live order alerts and Chart.js for dynamic, real-time data visualization of revenue and category metrics.
* **State Management**: Client-side cart and order state management using JavaScript and LocalStorage for data persistence across sessions.
* **Responsive Design System**: Custom-built CSS architecture utilizing CSS Variables and Grid/Flexbox layouts to ensure cross-device compatibility and dark/light mode toggling.
* **Simulated Checkout Flow**: Comprehensive UI for payment processing, including mock integrations for Credit Card, M-Pesa, and PayPal.

---

## Technology Stack

**Frontend:**
* HTML5 & Custom CSS3
* Vanilla JavaScript (ES6+)
* Chart.js (Data Visualization)
* Socket.io-client (Real-time communication)

**Simulated Backend Architecture:**
* **API Gateway:** Node.js / Express.js
* **Auth Service:** PostgreSQL, bcrypt, JWT
* **Product Service:** MongoDB
* **Order Service:** PostgreSQL

---

## Deployment (Netlify)

This project is a decoupled front-end application optimized for static hosting. It is deployed via Netlify,

**To deploy your own instance:**
1. Create a free account on [Netlify](https://www.netlify.com/).
2. Navigate to your Team Dashboard and select the **Sites** tab.
3. Drag and drop the main project folder (containing `index.html` and assets) into the manual deploy dropzone.
4. Configure your custom site name in the site settings.

---

## Local Development

To run this application locally for development or code review:

1. Clone the repository or download the source code folder.
2. Ensure `index.html` and all related assets (images, README) are in the root directory.
3. Serve the folder using a local web server. 
   * *If using VS Code, the "Live Server" extension is recommended.*
   * *Alternatively, you can open `index.html` directly in your browser.*

---

## Developer Note (Hidden Feature)

To access the simulated administrator panel for evaluation, click the *astronaut icon* on the login modal three times. This will reveal the hidden admin authentication bypass field.

---
Author: Nixon Mwalugha Mwaighonyi  
GitHub: [Nixon Mwalugha](https://github.com/NixonMMwaighonyi)
