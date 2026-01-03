# Guest Access Setup Guide

## Overview
This document explains how to properly configure the Blink database to allow guest (unauthenticated) users to access public content.

## Current Status

### Frontend Changes (✅ Completed)
- ✅ MainLayout.tsx: Allows rendering without authentication
- ✅ BoardsToolbar.tsx: Shows UI even when boards fail to load
- ✅ Mining shortcuts disabled for guests (M key)
- ✅ Guest-friendly messaging in UI

### Backend Configuration (⏳ Pending - Manual Setup Required)

## Required RLS Policy Configuration

To allow guests to view boards, threads, and posts, you need to configure the database security policies.

### Step 1: Access Blink Dashboard
1. Go to your Blink project dashboard
2. Navigate to **Database** → **Security Policies** or **Configuration**

### Step 2: Configure Public SELECT Access

Set the following policy configuration:

```json
{
  "modules": {
    "db": {
      "require_auth": false,
      "row_level": {
        "mode": "public"
      }
    }
  }
}
```

Alternatively, if you need more granular control:

```json
{
  "modules": {
    "db": {
      "tables": {
        "boards": {
          "select": "public",
          "insert": "authenticated",
          "update": "owner",
          "delete": "owner"
        },
        "threads": {
          "select": "public",
          "insert": "authenticated",
          "update": "owner",
          "delete": "owner"
        },
        "posts": {
          "select": "public",
          "insert": "authenticated",
          "update": "owner",
          "delete": "owner"
        },
        "users": {
          "select": "public",
          "insert": "authenticated",
          "update": "self",
          "delete": "self"
        }
      }
    }
  }
}
```

### Step 3: Verify Configuration

After updating the policy:
1. The changes take effect immediately (server cache is invalidated)
2. Test guest access:
   - Open an incognito/private browser window
   - Navigate to `/` (home page)
   - Verify boards load in the dropdown
   - Navigate to `/board/[slug]` to view threads

### Step 4: Monitor Console

Open browser DevTools and check:
- **Network tab**: No 403 Forbidden errors
- **Console**: No "Failed to load boards" errors
- **Application tab**: Verify requests are succeeding

## Troubleshooting

### Issue: "403 Forbidden" errors in console

**Cause**: RLS policies still require authentication for SELECT operations.

**Solution**:
1. Confirm policy configuration was saved
2. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
3. Check that `require_auth: false` is set

### Issue: Boards dropdown shows "No boards available"

**Cause**: Either no boards exist, or RLS is still blocking access.

**Solution**:
1. Create a test board via `/create-board` (requires login)
2. Log out and verify it shows in guest view
3. Check browser console for fetch errors

### Issue: Mining indicator appears for guests

**Cause**: Frontend mining shortcut still active.

**Solution**: Already fixed in this update - guests won't see the M key hint or be able to mine.

## Future Improvements

- [ ] Add rate limiting for guest reads to prevent abuse
- [ ] Implement separate read quotas for authenticated vs public users
- [ ] Add metrics to track guest engagement
- [ ] Consider implementing invite-only board creation
