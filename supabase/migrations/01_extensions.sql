-- Section 1: Extensions (schema-amendments.md §A)
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists vector with schema extensions;   -- FIX: was "pgvector"
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgmq;
