from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ResourceAuditStatus(_message.Message):
    __slots__ = ("audit",)
    AUDIT_FIELD_NUMBER: _ClassVar[int]
    audit: ResourceAudit
    def __init__(self, audit: _Optional[_Union[ResourceAudit, _Mapping]] = ...) -> None: ...

class ResourceAudit(_message.Message):
    __slots__ = ("spec_audit", "status_audit")
    SPEC_AUDIT_FIELD_NUMBER: _ClassVar[int]
    STATUS_AUDIT_FIELD_NUMBER: _ClassVar[int]
    spec_audit: ResourceAuditInfo
    status_audit: ResourceAuditInfo
    def __init__(self, spec_audit: _Optional[_Union[ResourceAuditInfo, _Mapping]] = ..., status_audit: _Optional[_Union[ResourceAuditInfo, _Mapping]] = ...) -> None: ...

class ResourceAuditInfo(_message.Message):
    __slots__ = ("created_by", "created_at", "updated_by", "updated_at", "event")
    CREATED_BY_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    UPDATED_BY_FIELD_NUMBER: _ClassVar[int]
    UPDATED_AT_FIELD_NUMBER: _ClassVar[int]
    EVENT_FIELD_NUMBER: _ClassVar[int]
    created_by: ResourceAuditActor
    created_at: _timestamp_pb2.Timestamp
    updated_by: ResourceAuditActor
    updated_at: _timestamp_pb2.Timestamp
    event: str
    def __init__(self, created_by: _Optional[_Union[ResourceAuditActor, _Mapping]] = ..., created_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., updated_by: _Optional[_Union[ResourceAuditActor, _Mapping]] = ..., updated_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., event: _Optional[str] = ...) -> None: ...

class ResourceAuditActor(_message.Message):
    __slots__ = ("id", "avatar")
    ID_FIELD_NUMBER: _ClassVar[int]
    AVATAR_FIELD_NUMBER: _ClassVar[int]
    id: str
    avatar: str
    def __init__(self, id: _Optional[str] = ..., avatar: _Optional[str] = ...) -> None: ...
