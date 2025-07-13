#!/bin/bash
echo "🔄 Testing manual cron execution..."
curl -X GET "http://localhost:3000/api/cron/execute-dca-v2" \
  -H "Authorization: Bearer $CRON_SECRET_KEY" \
  2>/dev/null | jq '.'