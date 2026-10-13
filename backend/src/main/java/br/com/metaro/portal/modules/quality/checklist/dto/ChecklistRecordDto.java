package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistRecordDto {
    private Long id;
    private Long flowId;
    private Long templateId;
    private Long creatorId;
    private Long ownerId;
    private String owner;
    private Long finisherId;
    private String signature;
    private Instant signedAt;
    private Instant created;
    private Instant updated;
    private Instant finished;
    private String status;
    private boolean automatic;
    private Map<String, ChecklistAnswerDto> answers = new HashMap<>();
    private Map<String, String> fields = new HashMap<>();
    private List<String> departments = new ArrayList<>();
    private List<ChecklistCommentDto> comments = new ArrayList<>();
    private List<ChecklistAuditDto> logs = new ArrayList<>();
    private List<ChecklistRevisionDto> revisions = new ArrayList<>();
    private long version;
}
