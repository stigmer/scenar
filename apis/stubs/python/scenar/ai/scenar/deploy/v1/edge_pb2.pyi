from ai.scenar.deploy.v1 import enum_pb2 as _enum_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class EdgeManifestFile(_message.Message):
    __slots__ = ("content_type", "size_bytes", "sha256")
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    SIZE_BYTES_FIELD_NUMBER: _ClassVar[int]
    SHA256_FIELD_NUMBER: _ClassVar[int]
    content_type: str
    size_bytes: int
    sha256: str
    def __init__(self, content_type: _Optional[str] = ..., size_bytes: _Optional[int] = ..., sha256: _Optional[str] = ...) -> None: ...

class EdgeDeployManifest(_message.Message):
    __slots__ = ("schema_version", "deploy_id", "scenario_id", "object_key_prefix", "csp", "files")
    class FilesEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: EdgeManifestFile
        def __init__(self, key: _Optional[str] = ..., value: _Optional[_Union[EdgeManifestFile, _Mapping]] = ...) -> None: ...
    SCHEMA_VERSION_FIELD_NUMBER: _ClassVar[int]
    DEPLOY_ID_FIELD_NUMBER: _ClassVar[int]
    SCENARIO_ID_FIELD_NUMBER: _ClassVar[int]
    OBJECT_KEY_PREFIX_FIELD_NUMBER: _ClassVar[int]
    CSP_FIELD_NUMBER: _ClassVar[int]
    FILES_FIELD_NUMBER: _ClassVar[int]
    schema_version: int
    deploy_id: str
    scenario_id: str
    object_key_prefix: str
    csp: str
    files: _containers.MessageMap[str, EdgeManifestFile]
    def __init__(self, schema_version: _Optional[int] = ..., deploy_id: _Optional[str] = ..., scenario_id: _Optional[str] = ..., object_key_prefix: _Optional[str] = ..., csp: _Optional[str] = ..., files: _Optional[_Mapping[str, EdgeManifestFile]] = ...) -> None: ...

class EdgeDeployState(_message.Message):
    __slots__ = ("state", "error_reason")
    STATE_FIELD_NUMBER: _ClassVar[int]
    ERROR_REASON_FIELD_NUMBER: _ClassVar[int]
    state: _enum_pb2.DeployState
    error_reason: str
    def __init__(self, state: _Optional[_Union[_enum_pb2.DeployState, str]] = ..., error_reason: _Optional[str] = ...) -> None: ...

class EdgeScenarioPointer(_message.Message):
    __slots__ = ("current_deploy_id", "deploy_origin")
    CURRENT_DEPLOY_ID_FIELD_NUMBER: _ClassVar[int]
    DEPLOY_ORIGIN_FIELD_NUMBER: _ClassVar[int]
    current_deploy_id: str
    deploy_origin: str
    def __init__(self, current_deploy_id: _Optional[str] = ..., deploy_origin: _Optional[str] = ...) -> None: ...
