# FinanceApp - Backend Core

![Node.js](https://img.shields.io/badge/Node.js-Backend-lightgreen)
![Express.js](https://img.shields.io/badge/Express.js-API-red)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-darkgreen)
![JWT](https://img.shields.io/badge/Auth-JWT-skyblue)
![Status](https://img.shields.io/badge/Status-v1.0%20Stable-success)

A scalable, enterprise-grade fintech backend system built with **Node.js**, **Express.js**, and **MongoDB**.

FinanceApp provides secure authentication, strict ledger transactions, dynamic fraud detection, analytics aggregations, and role-based admin controls suitable for banking or finance-based applications.

The project was built to demonstrate a production-style backend with clean microservice-style API design, secure user sessions, and comprehensive financial data processing.

---

## Table of Contents

* [Overview](#overview)
* [Key Features](#key-features)
* [Tech Stack](#tech-stack)
* [Project Architecture](#project-architecture)
* [Local Setup](#local-setup)
* [Environment Variables](#environment-variables)
* [Running the Server](#running-the-server)
* [API Architecture Contracts](#api-architecture-contracts)
* [Future Improvements](#future-improvements)
* [Contributing](#contributing)
* [Author](#author)

---

## Overview

FinanceApp is a complete backend-focused fintech core that handles sophisticated finance-related operations through REST APIs.

It follows a strict layered architecture:

```text
Router Layer
    ↓
Controller Layer
    ↓
Service Layer
    ↓
Database Models
```

This separation ensures routing, request validation, business logic, and database operations remain isolated, testable, and maintainable.

---

## Key Features

###  Secure Authentication & RBAC

* Stateless authentication using JSON Web Tokens (JWT)
* Password hashing via bcryptjs
* Role-Based Access Control (RBAC)
* Protected routes using Bearer tokens

###  Account Ledger Management

* Create, fetch, and soft-delete user bank accounts
* Real-time balance aggregation
* Strict ownership verification
* Multi-account support

###  ACID-Compliant Transactions

* Secure credits and debits
* Account-to-account transfers
* MongoDB transaction support
* Automatic insufficient-funds protection

###  Dynamic Fraud Detection Engine

* Risk scoring based on transaction patterns
* Velocity and amount-based checks
* Suspicious transaction flagging
* Admin review workflow

###  Analytics & Data Aggregation

* Monthly income and expense analysis
* Savings rate calculations
* Category-wise spending reports
* Dashboard-ready chart data

###  Statement Generation

* CSV export using json2csv
* PDF statement generation using pdfkit
* Downloadable account reports

###  Security & Error Handling

* Centralized error handling
* Custom ApiError and ApiResponse utilities
* Helmet security headers
* CORS protection

---

## Tech Stack

| Category       | Technology                     |
| -------------- | ------------------------------ |
| Runtime        | Node.js                        |
| Framework      | Express.js                     |
| Database       | MongoDB Atlas                  |
| ODM            | Mongoose                       |
| Authentication | JWT                            |
| Security       | bcryptjs, Helmet, CORS         |
| File Exporting | pdfkit, json2csv               |
| Architecture   | REST API, Layered Architecture |

---

## Project Architecture

The backend follows a clean modular folder structure:

```text
server/
├── .env
├── .gitignore
├── makeAdmin.js
├── server.js
│
└── src/
    ├── app.js
    │
    ├── config/
    │   ├── db.js
    │   └── env.js
    │
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── account.controller.js
    │   ├── transaction.controller.js
    │   ├── analytics.controller.js
    │   ├── admin.controller.js
    │   └── export.controller.js
    │
    ├── middleware/
    │   ├── auth.middleware.js
    │   ├── role.middleware.js
    │   └── validate.middleware.js
    │
    ├── models/
    │   ├── User.model.js
    │   ├── Account.model.js
    │   ├── Transaction.model.js
    │   ├── Transfer.model.js
    │   └── FraudAlert.model.js
    │
    ├── routes/
    ├── services/
    ├── validators/
    └── utils/
```

---

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/sahil0322/FINANCEAPP.git
```

### 2. Navigate to the Server Directory

```bash
cd server
```

### 3. Install Dependencies

```bash
npm install
```

---

## Environment Variables

Create a `.env` file inside the root of the server directory:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_cluster_srv_string
JWT_SECRET=your_cryptographic_signing_key_string
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

---

## Running the Server

```bash
node server.js
```

Development mode:

```bash
npx nodemon server.js
```

---

## API Architecture Contracts

###  Authentication (`/api/auth`)

| Method | Endpoint  | Access | Description                       |
| ------ | --------- | ------ | --------------------------------- |
| POST   | /register | Public | Register a new user               |
| POST   | /login    | Public | Authenticate user and receive JWT |
| GET    | /me       | User   | Get authenticated user profile    |

###  Accounts (`/api/accounts`)

| Method | Endpoint | Access | Description                      |
| ------ | -------- | ------ | -------------------------------- |
| POST   | /        | User   | Create account                   |
| GET    | /        | User   | Fetch user accounts and balances |

###  Transactions (`/api/transactions`)

| Method | Endpoint  | Access | Description          |
| ------ | --------- | ------ | -------------------- |
| POST   | /         | User   | Process credit/debit |
| POST   | /transfer | User   | Transfer funds       |
| GET    | /         | User   | Transaction history  |

###  Analytics (`/api/analytics`)

| Method | Endpoint  | Access | Description        |
| ------ | --------- | ------ | ------------------ |
| GET    | /summary  | User   | Financial overview |
| GET    | /monthly  | User   | Monthly trends     |
| GET    | /category | User   | Category breakdown |

###  Admin (`/api/admin`)

| Method | Endpoint          | Access | Description               |
| ------ | ----------------- | ------ | ------------------------- |
| GET    | /stats            | Admin  | Platform statistics       |
| GET    | /users            | Admin  | User management           |
| PATCH  | /users/:id/status | Admin  | Suspend or activate users |
| GET    | /fraud-alerts     | Admin  | Fraud review dashboard    |

###  Export (`/api/export`)

| Method | Endpoint | Access | Description                     |
| ------ | -------- | ------ | ------------------------------- |
| GET    | /csv     | User   | Export transactions as CSV      |
| GET    | /pdf     | User   | Export account statement as PDF |

---

## Future Improvements

* React / Next.js dashboard integration
* Plaid API bank synchronization
* Automated testing with Jest and Supertest
* Real-time transaction notifications
* Docker containerization
* CI/CD deployment pipeline
* Redis caching layer
* API documentation with Swagger

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/amazing-feature
```

3. Commit your changes

```bash
git commit -m "Add amazing feature"
```

4. Push your branch

```bash
git push origin feature/amazing-feature
```

5. Open a Pull Request

---

## Author

**Sahil Kapse**

* GitHub: https://github.com/sahil0322
* Email: [sahilkapse139@gmail.com]

---

 If you found this project useful, consider giving it a star on GitHub :)
