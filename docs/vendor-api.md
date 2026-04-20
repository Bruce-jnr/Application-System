# Vendor API Documentation

## Overview

The Vendor API allows authorized vendors to generate vouchers for the admission system. Each voucher costs GH₵360.00.

## Authentication

All endpoints require an API key to be included in the request header:
```
X-API-Key: your_api_key_here
```

## Base URL

```
https://nsacoe.edu.gh/api/vendor
```

## Endpoints

### Generate Voucher
Generate a new voucher with a unique serial number and PIN. Each voucher costs GH₵360.00.

**Endpoint:** `POST /vouchers/generate`

**Headers Required:**
- `X-API-Key`: f6efad630bec72d9c050c6ab6e4a05d058ba4f88d9e316eb770f465b07b646a5
- `Content-Type`: application/json

**Request Body:**
```json
{
    "quantity": 1
}
```

**Response:**
```json
{
    "success": true,
    "voucher": {
        "serialNumber": "NSCE25XXXXXX",
        "pin": "XXXXXX",
        "price": 360.00
    },
    "message": "Voucher generated successfully"
}
```

**Note:** The price is fixed at GH₵360.00 per voucher and cannot be modified.

## Error Handling

The API uses standard HTTP status codes:
- 200: Success
- 400: Bad Request (invalid input)
- 401: Unauthorized (invalid or missing API key)
- 404: Not Found (resource not found)
- 500: Internal Server Error

## Code Example

```javascript
const axios = require('axios');

// Create API client
const api = axios.create({
    baseURL: 'https://nsacoe.edu.gh/api/vendor',
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your_api_key_here'
    }
});

// Generate a voucher
async function generateVoucher() {
    try {
        const response = await api.post('/vouchers/generate', {
            quantity: 1
        });
        
        const { voucher } = response.data;
        console.log('Voucher generated:');
        console.log('Serial Number:', voucher.serialNumber);
        console.log('PIN:', voucher.pin);
        console.log('Price: GH₵' + voucher.price.toFixed(2));
        
        return response.data;
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        throw error;
    }
}

// Usage
generateVoucher();
```

## Support

For API support or to report issues:
- Email: asarebruce@gmail.com
- Phone: 0546535902