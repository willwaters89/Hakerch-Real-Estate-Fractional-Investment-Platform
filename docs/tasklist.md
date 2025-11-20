# Development Task List

## 1. User Account Creation (F1)

### User Story
As a new investor, I want to create an account so that I can start buying fractional shares.

### Task
Create user authentication using Supabase Auth (signup, login, session handling).

### Acceptance Criteria
Done means:
- User can create an account with email and password
- User can log in and stay authenticated
- Invalid login attempts show errors
- Protected routes block unauthenticated users


## 2. Property Details View (F4)

### User Story
As a new investor, I want to see property details so that I can decide whether the investment fits my budget and risk level.

### Task
Build a property detail page that displays property information, share price, and performance metrics.

### Acceptance Criteria
Done means:
- Property image, description, and address are visible
- Valuation, share price, and total shares are shown
- User’s owned shares appear if logged in
- Buy and Sell options are visible


## 3. Portfolio Tracking Dashboard (F8)

### User Story
As a returning investor, I want to track my portfolio performance so that I can monitor how my investments are growing over time.

### Task
Create a portfolio dashboard summarizing total value, holdings, and ROI.

### Acceptance Criteria
Done means:
- Total invested amount displayed
- Current portfolio value shown
- ROI percentage shown
- Holdings listed with share counts


## 4. Real-Time Property Statistics (F9)

### User Story
As a veteran investor, I want to view real-time property statistics so that I can quickly evaluate new investment opportunities.

### Task
Integrate real-time metrics into property pages.

### Acceptance Criteria
Done means:
- Real-time data loads successfully
- Data refreshes periodically
- Loading and error states appear


## 5. Fractional Buy Function (F5)

### User Story
As a new investor, I want to invest as little as $1 so that I can start building wealth without a large upfront cost.

### Task
Implement the buy process and USD-to-share conversion.

### Acceptance Criteria
Done means:
- User can input a USD amount of $1 or more
- USD converts to fractional shares
- Transaction logs to the database
- Portfolio updates after purchase


## 6. Fractional Sell Function (F6)

### User Story
As a veteran investor, I want to sell fractional shares so that I can rebalance my portfolio.

### Task
Create a sell flow with checks for owned shares.

### Acceptance Criteria
Done means:
- User can only sell shares they own
- Available share count shown
- Sell transaction saved in database
- Portfolio updates correctly


## 7. Notifications System (F10)

### User Story
As a user, I want to receive notifications about property updates so that I stay informed on changes that impact my investments.

### Task
Implement notification storage and UI display components.

### Acceptance Criteria
Done means:
- Notifications stored in the database
- User can see unread notifications
- Notifications appear when property updates occur


## 8. Property Listing Management (A1)

### User Story
As an administrator, I want to manage property listings so that users always see accurate and updated property information.

### Task
Create an admin interface for property creation, updates, and removal.

### Acceptance Criteria
Done means:
- Admin can create new listings
- Admin can update listing details
- Admin can deactivate or remove properties
- Admin-only access enforced


## 9. Transaction History (F7)

### User Story
As an investor, I want to view my full transaction history so that I can confirm my ownership and past activity.

### Task
Build a transaction history page pulling records from the database.

### Acceptance Criteria
Done means:
- All transactions displayed in order
- Each record shows date, time, property, amount, and shares
- Data aligns with the user’s portfolio history


## 10. Blockchain Verification (F7)

### User Story
As a user, I want the system to verify transactions through blockchain so that I can trust that my ownership records are secure.

### Task
Integrate blockchain hashing into transaction creation.

### Acceptance Criteria
Done means:
- Each transaction generates a blockchain hash
- Hash is stored with the transaction record
- Hash is visible to the user
- Transaction records cannot be altered afterward
