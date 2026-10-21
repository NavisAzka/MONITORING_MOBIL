CREATE TYPE "public"."user_role" AS ENUM('admin', 'driver');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"password_hash" text NOT NULL,
	"password_changed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"imei" text,
	"name" text NOT NULL,
	"passenger_capacity" integer,
	"current_passengers" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_imei_unique" UNIQUE("imei"),
	CONSTRAINT "vehicles_capacity_range" CHECK ("vehicles"."passenger_capacity" IS NULL OR "vehicles"."passenger_capacity" BETWEEN 1 AND 100),
	CONSTRAINT "vehicles_current_range" CHECK ("vehicles"."current_passengers" IS NULL OR "vehicles"."current_passengers" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_one_active_vehicle" ON "assignments" USING btree ("vehicle_id") WHERE "assignments"."ended_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_one_active_driver" ON "assignments" USING btree ("driver_id") WHERE "assignments"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "assignments_driver_started_idx" ON "assignments" USING btree ("driver_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");