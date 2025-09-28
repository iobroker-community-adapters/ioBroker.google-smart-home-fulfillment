# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

## Adapter-Specific Context

- **Adapter Name**: ioBroker.google-smart-home-fulfillment  
- **Primary Function**: A Google Smart Home Actions fulfillment server for ioBroker that enables Google Assistant integration
- **Key Features**: 
  - Google Assistant voice control integration
  - OAuth 2.0 authentication with Google
  - Smart home device state synchronization
  - HTTPS fulfillment endpoint for Google Assistant
- **Target Integration**: Google Smart Home platform via Actions on Google
- **Key Dependencies**: 
  - `actions-on-google`: Google Assistant integration library
  - `oidc-provider`: OAuth identity provider functionality  
  - `jose`: JWT token handling
  - Web adapter extension for HTTPS endpoints
- **Configuration Requirements**: 
  - Public FQDN for Google callbacks
  - SSL certificates (Let's Encrypt supported)
  - OAuth client credentials from Google Actions Console
  - Web adapter configuration for extension mode
- **Unique Challenges**:
  - Requires public internet accessibility
  - Complex OAuth flow with Google
  - Real-time state synchronization with Google Home Graph API
  - Extension mode operation (runs within web adapter)

## Development Guidelines

### ioBroker Adapter Patterns
- Follow ioBroker adapter development patterns
- Use appropriate logging levels: `this.log.error()`, `this.log.warn()`, `this.log.info()`, `this.log.debug()`
- Implement proper error handling and recovery mechanisms
- Ensure clean resource cleanup in `unload()` method
- Use `this.setState()` and `this.getState()` for state management
- Follow semantic versioning for releases

### Google Smart Home Specifics
- Implement OAuth 2.0 flows correctly for Google Assistant integration
- Handle Google Home Graph API calls with proper error handling
- Maintain device state synchronization between ioBroker and Google
- Implement proper request/response handling for fulfillment endpoints
- Follow Google Smart Home API patterns and device types
- Test with Google Assistant simulator and real devices

### Extension Mode Development
- Understand web adapter extension architecture
- Handle HTTP/HTTPS requests within ioBroker framework
- Manage Express.js middleware integration
- Implement proper routing for Google endpoints (/fulfillment, /oidc/auth, /oidc/token)

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock Google API calls and OAuth flows for testing
- Test both success and failure scenarios for API calls
- Example test structure:
  ```javascript
  describe('GoogleSmartHomeFulfillment', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
    
    test('should handle Google fulfillment requests', () => {
      // Test Google Assistant request handling
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test Google Smart Home fulfillment', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        // Get adapter object
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.google-smart-home-fulfillment.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            publicFQDN: 'test.example.com',
                            homeGraphJSONKey: '{"project_id": "test"}',
                            oAuthClientId: 'test-client-id',
                            oAuthClientSecret: 'test-client-secret'
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Adapter started');

                        // Wait for initialization
                        await new Promise(resolve => setTimeout(resolve, 5000));

                        console.log('🔍 Checking adapter state...');
                        
                        // Check if adapter is running
                        const isRunning = harness.isAdapterRunning();
                        if (!isRunning) {
                            return reject(new Error('Adapter is not running after start'));
                        }

                        console.log('✅ Integration test completed successfully');
                        resolve(true);

                    } catch (error) {
                        console.error('❌ Integration test failed:', error);
                        reject(error);
                    }
                });
            }).timeout(30000);
        });
    }
});
```

#### Google API Testing Considerations
- Mock Google Smart Home API calls during testing
- Test OAuth flows with mock credentials
- Verify proper handling of Google Assistant requests
- Test device state synchronization logic
- Handle network connectivity issues gracefully

## Error Handling

### Google API Error Handling
```javascript
// Example: Handle Google Home Graph API errors
async function syncDevices() {
  try {
    const result = await homeGraph.devices.sync({
      // sync parameters
    });
    this.log.info('Device sync successful');
    return result;
  } catch (error) {
    if (error.code === 401) {
      this.log.error('Authentication failed - check OAuth credentials');
    } else if (error.code === 429) {
      this.log.warn('Rate limit exceeded - implementing backoff');
      // Implement exponential backoff
    } else {
      this.log.error(`Google API error: ${error.message}`);
    }
    throw error;
  }
}
```

### OAuth Error Handling
```javascript
// Handle OAuth token refresh
async function refreshToken() {
  try {
    const tokenResponse = await oauth2Client.refreshAccessToken();
    this.log.debug('OAuth token refreshed successfully');
    return tokenResponse;
  } catch (error) {
    this.log.error(`OAuth token refresh failed: ${error.message}`);
    // Handle token expiration, invalid refresh token, etc.
    throw error;
  }
}
```

## Extension Mode Integration

### Web Adapter Extension Setup
```javascript
// Example: Proper extension initialization
class GoogleSmartHomeFulfillment {
  constructor(webInstance) {
    this.webInstance = webInstance;
    this.app = webInstance.app;
    this.adapter = webInstance.adapter;
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    // Setup Google fulfillment endpoint
    this.app.post('/fulfillment', this.handleFulfillment.bind(this));
    
    // Setup OAuth endpoints  
    this.app.get('/oidc/auth', this.handleAuth.bind(this));
    this.app.post('/oidc/token', this.handleToken.bind(this));
  }
}
```

### Resource Cleanup
```javascript
// Proper cleanup in unload method
unload(callback) {
  try {
    // Clear any intervals/timeouts
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
    
    // Close OAuth provider
    if (this.oidcProvider) {
      this.oidcProvider.close();
    }
    
    // Clean up Google API clients
    if (this.homeGraph) {
      this.homeGraph = null;
    }
    
    this.log.info('Google Smart Home fulfillment adapter stopped');
    callback();
  } catch (error) {
    this.log.error(`Error during cleanup: ${error.message}`);
    callback();
  }
}
```

## State Management

### Device State Synchronization
```javascript
// Example: Sync device states with Google
async function syncDeviceState(deviceId, state) {
  try {
    // Update local ioBroker state
    await this.setStateAsync(`devices.${deviceId}.state`, state);
    
    // Sync with Google Home Graph
    await this.reportStateToGoogle(deviceId, state);
    
    this.log.debug(`Device ${deviceId} state synchronized`);
  } catch (error) {
    this.log.error(`Failed to sync device state: ${error.message}`);
  }
}
```

## Configuration Management

### JSON Configuration Handling
```javascript
// Safe JSON parsing for Google credentials
parseGoogleCredentials(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    this.log.error('Invalid Google credentials JSON format');
    throw new Error('Invalid Google credentials format');
  }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations consistently
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods
- Handle all Promise rejections appropriately
- Use TypeScript types where available for better code quality

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
google-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run Google API tests
      run: npm run test:integration-google
      env:
        GOOGLE_TEST_CREDENTIALS: ${{ secrets.GOOGLE_TEST_CREDENTIALS }}
```

### Package.json Script Integration
Add dedicated script for Google API testing:
```json
{
  "scripts": {
    "test:integration-google": "mocha test/integration-google --exit --timeout 60000"
  }
}
```