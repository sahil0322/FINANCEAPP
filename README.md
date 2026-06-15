# FinanceApp - Backend Core

![Node.js](https://img.shields.io/badge/Node.js-Backend-green)
![Express.js](https://img.shields.io/badge/Express.js-API-black)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-brightgreen)
![JWT](https://img.shields.io/badge/Auth-JWT-blue)
![Status](https://img.shields.io/badge/Status-Active%20Development-orange)

A scalable fintech backend system built with **Node.js**, **Express.js**, and **MongoDB**.  
FinanceApp provides secure authentication, account management, transaction tracking, and a structured backend architecture suitable for banking or finance-based applications.

The project was built to demonstrate a production-style backend with clean API design, secure user sessions, database-driven account handling, and reusable utility patterns.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Architecture](#project-architecture)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Running the Server](#running-the-server)
- [API Architecture Contracts](#api-architecture-contracts)
  - [Authentication Gateway](#authentication-gateway)
  - [Account Ledger Gateway](#account-ledger-gateway)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## Overview

FinanceApp is a backend-focused fintech application that handles core finance-related operations through REST APIs.

It follows a clean layered architecture:

```text
Router Layer  ->  Controller Layer  ->  Service Layer
````

This separation keeps routing, request handling, business logic, and database operations organized and maintainable.

---

## Key Features

* **Secure Authentication**

  * User registration and login
  * Password hashing using `bcryptjs`
  * Stateless authentication using JSON Web Tokens

* **JWT-Based Authorization**

  * Protected private routes
  * Bearer token verification
  * Authenticated user context handling

* **Account Management**

  * Create user bank/account records
  * Fetch account details
  * Update account information
  * Soft-delete account records instead of permanent deletion

* **Balance Aggregation**

  * Supports total balance calculation across user accounts

* **Ownership Verification**

  * Prevents users from modifying or deleting accounts that do not belong to them

* **Structured Error Handling**

  * Centralized async error handling
  * Custom `ApiError` utility
  * Clean API responses through `ApiResponse`

* **Security Middleware**

  * Helmet for secure HTTP headers
  * CORS configuration for client-server communication

* **Scalable Backend Design**

  * Modular folder structure
  * Router, controller, and service layer separation
  * Suitable for future features like transaction history and fraud detection

---

## Tech Stack

| Category               | Technology                             |
| ---------------------- | -------------------------------------- |
| Runtime                | Node.js                                |
| Framework              | Express.js                             |
| Database               | MongoDB Atlas                          |
| ODM                    | Mongoose                               |
| Authentication         | JWT                                    |
| Password Hashing       | bcryptjs                               |
| Security               | Helmet, CORS                           |
| Environment Management | dotenv                                 |
| Architecture           | REST API, Layered Backend Architecture |

---

## Project Architecture

The backend follows a clean and modular folder structure with separate layers for configuration, models, controllers, services, routes, middleware, validators, and utilities.

```text
server/
│
├── src/
│   │
│   ├── config/
│   │   ├── db.js
│   │   └── env.js
│   │
│   ├── models/
│   │   ├── User.model.js
│   │   ├── Account.model.js
│   │   ├── Transaction.model.js
│   │   ├── Transfer.model.js
│   │   └── FraudAlert.model.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   └── account.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   └── account.service.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   └── account.routes.js
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   └── validate.middleware.js
│   │
│   ├── validators/
│   │   ├── auth.validators.js
│   │   └── account.validators.js
│   │
│   ├── utils/
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   ├── asyncHandler.js
│   │   └── generateToken.js
│   │
│   └── app.js
│
└── server.js
```

### Architecture Flow

```text
Request
   ↓
Routes
   ↓
Validators / Middleware
   ↓
Controllers
   ↓
Services
   ↓
Models
   ↓
MongoDB
```
> Note: Folder names may differ slightly depending on your actual project structure.

---

## Local Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
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

Create a `.env` file inside the root of the `server` directory and add the following variables:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_cluster_srv_string
ALPHA_VANTAGE_API_KEY=your_market_data_api_key
JWT_SECRET=your_cryptographic_signing_key_string
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

### Environment Variable Explanation

| Variable                | Description                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `PORT`                  | Port number on which the backend server will run               |
| `NODE_ENV`              | Application environment, usually `development` or `production` |
| `MONGO_URI`             | MongoDB Atlas connection string                                |
| `ALPHA_VANTAGE_API_KEY` | API key for market/finance data integration                    |
| `JWT_SECRET`            | Secret key used to sign JWT tokens                             |
| `JWT_EXPIRES_IN`        | JWT token expiry duration                                      |
| `CLIENT_URL`            | Frontend client URL allowed through CORS                       |

---

## Running the Server

Start the backend server using:

```bash
node server.js
```

If you are using Nodemon for development, you can run:

```bash
npx nodemon server.js
```

Once the server starts successfully, it should run on:

```text
http://localhost:5000
```

---

## API Architecture Contracts

### Authentication Gateway

Base Route:

```text
/api/auth
```

| HTTP Method | Resource Target | Authorization        | Execution Scope                                                                                |
| ----------- | --------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| POST        | `/register`     | Public               | Creates a new user, hashes the password, stores user data, and returns an authentication token |
| POST        | `/login`        | Public               | Validates user credentials, compares hashed password, and signs a JWT if authorized            |
| GET         | `/me`           | Private - JWT Bearer | Decodes the token, verifies user context, and returns the authenticated user profile           |

---

### Account Ledger Gateway

Base Route:

```text
/api/accounts
```

| HTTP Method | Resource Target | Authorization        | Execution Scope                                                      |
| ----------- | --------------- | -------------------- | -------------------------------------------------------------------- |
| POST        | `/`             | Private - JWT Bearer | Creates a new account record linked to the authenticated user        |
| GET         | `/`             | Private - JWT Bearer | Fetches user accounts and supports account balance aggregation       |
| PUT         | `/:id`          | Private - JWT Bearer | Updates account details after verifying account ownership            |
| DELETE      | `/:id`          | Private - JWT Bearer | Performs a soft-delete by marking account state as inactive or false |

---

## Example API Flow

### Register a User

```http
POST /api/auth/register
```

Example request body:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "strongpassword123"
}
```

---

### Login User

```http
POST /api/auth/login
```

Example request body:

```json
{
  "email": "john@example.com",
  "password": "strongpassword123"
}
```

---

### Get Current User

```http
GET /api/auth/me
```

Required header:

```http
Authorization: Bearer <your_jwt_token>
```

---

### Create Account

```http
POST /api/accounts
```

Required header:

```http
Authorization: Bearer <your_jwt_token>
```

Example request body:

```json
{
  "accountName": "Savings Account",
  "accountType": "savings",
  "balance": 10000
}
```

---

## Future Improvements

* Transaction history module
* Rule-based fraud detection engine
* Market data dashboard integration
* Budget tracking system
* Email notification service
* Rate limiting for sensitive endpoints
* API documentation using Swagger or Postman
* Docker support for easier deployment

---

## Contributing

Contributions are welcome.

To contribute:

1. Fork the repository
2. Create a new branch

```bash
git checkout -b feature/your-feature-name
```

3. Make your changes
4. Commit your changes

```bash
git commit -m "Add your meaningful commit message"
```

5. Push to your branch

```bash
git push origin feature/your-feature-name
```

6. Open a Pull Request

Please keep the code clean, modular, and consistent with the existing project structure.

---

## License

This project currently does not have a license.

You can add one later, such as:

```text
MIT License
```

---

## Author

**SAHIL KAPSE**

---

## Project Status

This project is currently under active development.

Core backend modules such as authentication, account management, JWT authorization, and structured API utilities have been implemented. More fintech-specific features can be added in future versions.

```

