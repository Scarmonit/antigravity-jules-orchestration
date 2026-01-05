
## Jules Health Check

To verify the health of the system:

1. **Jules Health Check**:
   - Checks the connection to the Jules API.
   - Checks the connection to GitHub.
   - Checks the connection to the Semantic Memory service.
   - Checks the status of the Circuit Breaker.
   - Checks the status of the RAG index.

2. **Run Health Check**:
   - The health check is available at `/health`.
   - You can also run the `jules_health_check` tool via the MCP protocol.

   **Example MCP Request:**
   ```json
   {
     "tool": "jules_health_check",
     "parameters": {}
   }
   ```
