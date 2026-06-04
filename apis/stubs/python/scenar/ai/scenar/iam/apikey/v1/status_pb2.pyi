from ai.scenar.commons.apiresource import field_options_pb2 as _field_options_pb2
from ai.scenar.commons.apiresource import status_pb2 as _status_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ApiKeyStatus(_message.Message):
    __slots__ = ("last_used_at", "plaintext_key", "audit")
    LAST_USED_AT_FIELD_NUMBER: _ClassVar[int]
    PLAINTEXT_KEY_FIELD_NUMBER: _ClassVar[int]
    AUDIT_FIELD_NUMBER: _ClassVar[int]
    last_used_at: _timestamp_pb2.Timestamp
    plaintext_key: str
    audit: _status_pb2.ApiResourceAudit
    def __init__(self, last_used_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., plaintext_key: _Optional[str] = ..., audit: _Optional[_Union[_status_pb2.ApiResourceAudit, _Mapping]] = ...) -> None: ...
