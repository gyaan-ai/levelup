#!/bin/bash

# Script to run Supabase migration
# Usage: ./scripts/run-migration.sh

echo "🚀 Running LevelUp database migration..."
echo ""
echo "Choose an option:"
echo "1. Run via Supabase Dashboard (recommended for first time)"
echo "2. Run via Supabase CLI (if installed)"
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
  1)
    echo ""
    echo "📋 To run via Supabase Dashboard:"
    echo "1. Go to: https://supabase.com/dashboard/project/zbpjayhcnnasfddasnpi/sql/new"
    echo "2. Copy the contents of: supabase/migrations/20240105000000_initial_schema.sql"
    echo "3. Paste into the SQL Editor"
    echo "4. Click 'Run'"
    ;;
  2)
    if command -v supabase &> /dev/null; then
      echo "Running migration via Supabase CLI..."
      supabase db push
    else
      echo "❌ Supabase CLI not found. Install it with: npm install -g supabase"
      exit 1
    fi
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

