# Quick Fix for Dashboard "Failed to fetch" Error

The dashboard error is likely because the `workflow_state` column doesn't exist in the database yet.

## Quick Fix - Run this SQL:

```sql
-- Add workflow_state column if it doesn't exist
ALTER TABLE auctions 
ADD COLUMN IF NOT EXISTS workflow_state VARCHAR(50) DEFAULT 'active';

-- Set default workflow_state for existing auctions
UPDATE auctions 
SET workflow_state = CASE
  WHEN status = 'active' THEN 'active'
  WHEN status = 'ended' AND winner_id IS NOT NULL THEN 'pending_sale'
  WHEN status = 'ended' AND winner_id IS NULL THEN 'pending_sale'
  WHEN status = 'cancelled' THEN 'cancelled'
  ELSE 'active'
END
WHERE workflow_state IS NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_auctions_workflow_state ON auctions(workflow_state);
```

## How to Run:

### Option 1: Using Docker Compose
```bash
cd database-service
docker-compose exec postgres psql -U postgres -d auction_db -c "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS workflow_state VARCHAR(50) DEFAULT 'active';"
docker-compose exec postgres psql -U postgres -d auction_db -c "UPDATE auctions SET workflow_state = CASE WHEN status = 'active' THEN 'active' WHEN status = 'ended' AND winner_id IS NOT NULL THEN 'pending_sale' WHEN status = 'ended' AND winner_id IS NULL THEN 'pending_sale' WHEN status = 'cancelled' THEN 'cancelled' ELSE 'active' END WHERE workflow_state IS NULL;"
docker-compose exec postgres psql -U postgres -d auction_db -c "CREATE INDEX IF NOT EXISTS idx_auctions_workflow_state ON auctions(workflow_state);"
```

### Option 2: Using psql directly
```bash
psql -U postgres -d auction_db -f database-service/run-workflow-migration.sql
```

### Option 3: Run the full migration
```bash
cd database-service
npm run build
npm run migrate
```

After running this, refresh the dashboard page and it should work!
