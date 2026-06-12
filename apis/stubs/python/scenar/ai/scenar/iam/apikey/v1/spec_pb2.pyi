from ai.scenar.commons.apiresource import field_options_pb2 as _field_options_pb2
from ai.scenar.iam.apikey.v1 import enum_pb2 as _enum_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ApiKeySpec(_message.Message):
    __slots__ = ("key_hash", "fingerprint", "expires_at", "never_expires", "scopes")
    KEY_HASH_FIELD_NUMBER: _ClassVar[int]
    FINGERPRINT_FIELD_NUMBER: _ClassVar[int]
    EXPIRES_AT_FIELD_NUMBER: _ClassVar[int]
    NEVER_EXPIRES_FIELD_NUMBER: _ClassVar[int]
    SCOPES_FIELD_NUMBER: _ClassVar[int]
    key_hash: str
    fingerprint: str
    expires_at: _timestamp_pb2.Timestamp
    never_expires: bool
    scopes: _containers.RepeatedScalarFieldContainer[_enum_pb2.ApiKeyScope]
    def __init__(self, key_hash: _Optional[str] = ..., fingerprint: _Optional[str] = ..., expires_at: _Optional[_Union[_timestamp_pb2.Timestamp, _Mapping]] = ..., never_expires: bool = ..., scopes: _Optional[_Iterable[_Union[_enum_pb2.ApiKeyScope, str]]] = ...) -> None: ...
