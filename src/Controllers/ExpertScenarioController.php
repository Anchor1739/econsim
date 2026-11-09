<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Services\ExpertScenarioService;
use App\Utils\Response;
use Throwable;

class ExpertScenarioController
{
    /**
     * Submit an expert real-world scenario (user or guest)
     */
    public function submit(): void
    {
        $user = AuthService::getCurrentUser();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        // Auto-fill contributor name and email from profile if authenticated and not provided
        if ($user) {
            if (empty($body['contributor_name'])) {
                $body['contributor_name'] = $user['display_name'] ?? 'Executive Contributor';
            }
            if (empty($body['contributor_email'])) {
                $body['contributor_email'] = $user['email'] ?? '';
            }
        }

        try {
            $res = ExpertScenarioService::submitScenario($user['id'] ?? null, $body);
            Response::success($res, 'Scenario successfully uploaded and packaged. It is awaiting verification by an Institutional Administrator.', 201);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * Get user's submitted scenarios
     */
    public function mySubmissions(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
            return;
        }

        try {
            $pdo = \App\Config\Database::getConnection();
            $stmt = $pdo->prepare(
                "SELECT s.id, s.title, s.status, s.difficulty, s.created_at, s.reviewed_at,
                        s.admin_review_notes, i.name AS industry_name, s.approved_scenario_id
                 FROM expert_scenario_submissions s
                 JOIN industries i ON i.id = s.industry_id
                 WHERE s.contributor_id = ?
                 ORDER BY s.created_at DESC"
            );
            $stmt->execute([$user['id']]);
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            Response::success($rows);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}
