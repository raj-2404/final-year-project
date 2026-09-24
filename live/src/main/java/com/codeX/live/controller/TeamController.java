package com.codeX.live.controller;

import com.codeX.live.dto.AddTeamMemberRequest;
import com.codeX.live.service.TeamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/team")
@CrossOrigin(origins = "*", maxAge = 3600)
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;

    @GetMapping
    public ResponseEntity<?> getTeamMembers(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return teamService.getTeamMembers(userDetails.getUsername());
    }

    // Send a team request / invitation to a user
    @PostMapping("/request")
    public ResponseEntity<?> sendTeamRequest(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody AddTeamMemberRequest request
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return teamService.sendTeamRequest(userDetails.getUsername(), request);
    }

    // Backward-compatible alias for /add -> routes to sendTeamRequest
    @PostMapping("/add")
    public ResponseEntity<?> addTeamMember(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody AddTeamMemberRequest request
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return teamService.sendTeamRequest(userDetails.getUsername(), request);
    }

    // Get incoming pending requests received by user
    @GetMapping("/requests/incoming")
    public ResponseEntity<?> getIncomingRequests(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return teamService.getIncomingRequests(userDetails.getUsername());
    }

    // Get sent pending requests
    @GetMapping("/requests/sent")
    public ResponseEntity<?> getSentRequests(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return teamService.getSentRequests(userDetails.getUsername());
    }

    // Accept an incoming team request
    @PostMapping("/requests/{requestId}/accept")
    public ResponseEntity<?> acceptTeamRequest(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long requestId
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return teamService.acceptTeamRequest(userDetails.getUsername(), requestId);
    }

    // Reject an incoming team request
    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<?> rejectTeamRequest(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long requestId
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return teamService.rejectTeamRequest(userDetails.getUsername(), requestId);
    }

    // Cancel a sent request
    @DeleteMapping("/requests/{requestId}")
    public ResponseEntity<?> cancelSentRequest(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long requestId
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return teamService.cancelSentRequest(userDetails.getUsername(), requestId);
    }

    // Remove a member from team
    @DeleteMapping("/{memberId}")
    public ResponseEntity<?> removeTeamMember(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long memberId
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return teamService.removeTeamMember(userDetails.getUsername(), memberId);
    }

    // Search users by query
    @GetMapping("/search")
    public ResponseEntity<?> searchUsers(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(name = "q", defaultValue = "") String query
    ) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return teamService.searchUsers(userDetails.getUsername(), query);
    }
}
