from ai.scenar.commons.apiresource import field_options_pb2 as _field_options_pb2
from ai.scenar.commons.apiresource import status_pb2 as _status_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class OrganizationStatus(_message.Message):
    __slots__ = ("member_count", "audit")
    MEMBER_COUNT_FIELD_NUMBER: _ClassVar[int]
    AUDIT_FIELD_NUMBER: _ClassVar[int]
    member_count: int
    audit: _status_pb2.ApiResourceAudit
    def __init__(self, member_count: _Optional[int] = ..., audit: _Optional[_Union[_status_pb2.ApiResourceAudit, _Mapping]] = ...) -> None: ...
