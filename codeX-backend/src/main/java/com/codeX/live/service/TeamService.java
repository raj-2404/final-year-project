package com.codeX.live.service;

import com.codeX.live.dto.AddTeamMemberRequest;
import com.codeX.live.dto.TeamMemberDto;
import com.codeX.live.dto.TeamRequestDto;
import com.codeX.live.dto.UserDto;
import com.codeX.live.entity.TeamMember;
import com.codeX.live.entity.TeamRequest;
import com.codeX.live.entity.User;
import com.codeX.live.repository.TeamMemberRepository;
import com.codeX.live.repository.TeamRequestRepository;
import com.codeX.live.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamMemberRepository teamMemberRepository;
    private final TeamRequestRepository teamRequestRepository;
    private final UserRepository userRepository;

    private User getAuthenticatedUser(String identifier) {
        return userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found: " + identifier));
    }

    public ResponseEntity<?> getTeamMembers(String identifier) {
        User owner = getAuthenticatedUser(identifier);
        List<TeamMemberDto> members = teamMemberRepository.findByOwnerOrderByCreatedAtDesc(owner)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());

        long pendingIncomingCount = teamRequestRepository.countByReceiverAndStatus(owner, "PENDING");

        return ResponseEntity.ok(Map.of(
                "members", members,
                "count", members.size(),
                "pendingRequestsCount", pendingIncomingCount
        ));
    }

    @Transactional
    public ResponseEntity<?> sendTeamRequest(String identifier, AddTeamMemberRequest request) {
        User sender = getAuthenticatedUser(identifier);

        Optional<User> receiverOpt = Optional.empty();

        if (request.getUserId() != null) {
            receiverOpt = userRepository.findById(request.getUserId());
        } else if (request.getUsername() != null && !request.getUsername().trim().isEmpty()) {
            String u = request.getUsername().trim();
            if (u.startsWith("@")) {
                u = u.substring(1);
            }
            receiverOpt = userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(u, u);
        }

        if (receiverOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User not found with provided ID or username"));
        }

        User receiver = receiverOpt.get();

        if (receiver.getId().equals(sender.getId())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "You cannot send a team request to yourself"));
        }

        if (teamMemberRepository.existsByOwnerIdAndMemberId(sender.getId(), receiver.getId())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "@" + receiver.getUsername() + " is already in your team"));
        }

        if (teamRequestRepository.existsBySenderIdAndReceiverIdAndStatus(sender.getId(), receiver.getId(), "PENDING")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Team request already sent to @" + receiver.getUsername() + " and is pending response"));
        }

        // Check if reciprocal pending request already exists -> auto-accept
        Optional<TeamRequest> reciprocal = teamRequestRepository.findBySenderIdAndReceiverId(receiver.getId(), sender.getId());
        if (reciprocal.isPresent() && "PENDING".equals(reciprocal.get().getStatus())) {
            return acceptTeamRequest(identifier, reciprocal.get().getId());
        }

        TeamRequest teamRequest = teamRequestRepository.findBySenderIdAndReceiverId(sender.getId(), receiver.getId())
                .orElseGet(() -> TeamRequest.builder()
                        .sender(sender)
                        .receiver(receiver)
                        .build());

        teamRequest.setStatus("PENDING");
        teamRequestRepository.save(teamRequest);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Team request sent to @" + receiver.getUsername() + "!",
                "request", toRequestDto(teamRequest)
        ));
    }

    public ResponseEntity<?> getIncomingRequests(String identifier) {
        User user = getAuthenticatedUser(identifier);
        List<TeamRequestDto> incoming = teamRequestRepository
                .findByReceiverAndStatusOrderByCreatedAtDesc(user, "PENDING")
                .stream()
                .map(this::toRequestDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(incoming);
    }

    public ResponseEntity<?> getSentRequests(String identifier) {
        User user = getAuthenticatedUser(identifier);
        List<TeamRequestDto> sent = teamRequestRepository
                .findBySenderAndStatusOrderByCreatedAtDesc(user, "PENDING")
                .stream()
                .map(this::toRequestDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(sent);
    }

    @Transactional
    public ResponseEntity<?> acceptTeamRequest(String identifier, Long requestId) {
        User user = getAuthenticatedUser(identifier);

        TeamRequest request = teamRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (!request.getReceiver().getId().equals(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You can only respond to requests sent to you"));
        }

        request.setStatus("ACCEPTED");
        teamRequestRepository.save(request);

        User sender = request.getSender();

        // Add sender to user's team
        if (!teamMemberRepository.existsByOwnerIdAndMemberId(user.getId(), sender.getId())) {
            teamMemberRepository.save(TeamMember.builder().owner(user).member(sender).build());
        }

        // Add user to sender's team (mutual collaboration)
        if (!teamMemberRepository.existsByOwnerIdAndMemberId(sender.getId(), user.getId())) {
            teamMemberRepository.save(TeamMember.builder().owner(sender).member(user).build());
        }

        return getTeamMembers(identifier);
    }

    @Transactional
    public ResponseEntity<?> rejectTeamRequest(String identifier, Long requestId) {
        User user = getAuthenticatedUser(identifier);

        TeamRequest request = teamRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (!request.getReceiver().getId().equals(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You can only respond to requests sent to you"));
        }

        request.setStatus("REJECTED");
        teamRequestRepository.save(request);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Request rejected"
        ));
    }

    @Transactional
    public ResponseEntity<?> cancelSentRequest(String identifier, Long requestId) {
        User user = getAuthenticatedUser(identifier);

        TeamRequest request = teamRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        if (!request.getSender().getId().equals(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You can only cancel your own sent requests"));
        }

        teamRequestRepository.delete(request);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Request cancelled"
        ));
    }

    @Transactional
    public ResponseEntity<?> removeTeamMember(String identifier, Long memberId) {
        User owner = getAuthenticatedUser(identifier);
        teamMemberRepository.deleteByOwnerIdAndMemberId(owner.getId(), memberId);
        // Also remove reciprocal
        teamMemberRepository.deleteByOwnerIdAndMemberId(memberId, owner.getId());
        return getTeamMembers(identifier);
    }

    public ResponseEntity<?> searchUsers(String identifier, String query) {
        User owner = getAuthenticatedUser(identifier);
        String q = query != null ? query.trim() : "";
        if (q.startsWith("@")) {
            q = q.substring(1);
        }

        List<UserDto> users = userRepository
                .findTop10ByUsernameContainingIgnoreCaseOrNameContainingIgnoreCaseOrEmailContainingIgnoreCase(q, q, q)
                .stream()
                .filter(u -> !u.getId().equals(owner.getId()))
                .map(u -> UserDto.builder()
                        .id(u.getId())
                        .username(u.getUsername())
                        .name(u.getName())
                        .email(u.getEmail())
                        .createdAt(u.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(users);
    }

    private TeamMemberDto toDto(TeamMember tm) {
        User m = tm.getMember();
        return TeamMemberDto.builder()
                .id(tm.getId())
                .memberId(m.getId())
                .username(m.getUsername())
                .name(m.getName())
                .email(m.getEmail())
                .joinedAt(tm.getCreatedAt())
                .build();
    }

    private TeamRequestDto toRequestDto(TeamRequest tr) {
        User s = tr.getSender();
        User r = tr.getReceiver();
        return TeamRequestDto.builder()
                .id(tr.getId())
                .senderId(s.getId())
                .senderUsername(s.getUsername())
                .senderName(s.getName())
                .senderEmail(s.getEmail())
                .receiverId(r.getId())
                .receiverUsername(r.getUsername())
                .receiverName(r.getName())
                .receiverEmail(r.getEmail())
                .status(tr.getStatus())
                .createdAt(tr.getCreatedAt())
                .build();
    }
}
