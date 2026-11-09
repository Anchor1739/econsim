-- 002_feedback_and_expert_scenarios.sql
-- EconSim User Feedback & Real-World Expert Scenario Ingestion System

CREATE TABLE IF NOT EXISTS user_feedbacks (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NULL,
    category VARCHAR(80) NOT NULL DEFAULT 'general',
    rating TINYINT UNSIGNED NULL,
    message TEXT NOT NULL,
    contact_email VARCHAR(255) NULL,
    page_url VARCHAR(255) NULL,
    user_agent VARCHAR(500) NULL,
    status ENUM('new', 'reviewed', 'resolved', 'archived') NOT NULL DEFAULT 'new',
    admin_notes TEXT NULL,
    reviewed_by CHAR(36) NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    reviewed_at DATETIME(3) NULL,
    INDEX idx_feedback_status (status, created_at),
    INDEX idx_feedback_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expert_scenario_submissions (
    id CHAR(36) PRIMARY KEY,
    contributor_id CHAR(36) NULL,
    contributor_name VARCHAR(200) NOT NULL,
    contributor_role VARCHAR(200) NOT NULL,
    contributor_email VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NULL,
    industry_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(300) NOT NULL,
    scenario_dilemma LONGTEXT NOT NULL,
    key_metrics JSON NULL,
    decision_options TEXT NOT NULL,
    actual_decision_made TEXT NOT NULL,
    actual_outcome_result LONGTEXT NOT NULL,
    lessons_learned TEXT NULL,
    difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'intermediate',
    status ENUM('pending_review', 'approved', 'rejected') NOT NULL DEFAULT 'pending_review',
    admin_review_notes TEXT NULL,
    approved_scenario_id CHAR(36) NULL,
    reviewed_by CHAR(36) NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    reviewed_at DATETIME(3) NULL,
    INDEX idx_expert_sub_status (status, created_at),
    INDEX idx_expert_sub_contributor (contributor_id),
    FOREIGN KEY (contributor_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_scenario_id) REFERENCES boardroom_scenarios(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

