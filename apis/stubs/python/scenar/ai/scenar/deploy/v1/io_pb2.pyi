from ai.scenar.deploy.v1 import spec_pb2 as _spec_pb2
from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ListDeploysRequest(_message.Message):
    __slots__ = ("scenario_id", "page_size", "page_token")
    SCENARIO_ID_FIELD_NUMBER: _ClassVar[int]
    PAGE_SIZE_FIELD_NUMBER: _ClassVar[int]
    PAGE_TOKEN_FIELD_NUMBER: _ClassVar[int]
    scenario_id: str
    page_size: int
    page_token: str
    def __init__(self, scenario_id: _Optional[str] = ..., page_size: _Optional[int] = ..., page_token: _Optional[str] = ...) -> None: ...

class FileUploadTarget(_message.Message):
    __slots__ = ("relative_path", "object_key", "presigned_put_url", "required_headers")
    class RequiredHeadersEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    RELATIVE_PATH_FIELD_NUMBER: _ClassVar[int]
    OBJECT_KEY_FIELD_NUMBER: _ClassVar[int]
    PRESIGNED_PUT_URL_FIELD_NUMBER: _ClassVar[int]
    REQUIRED_HEADERS_FIELD_NUMBER: _ClassVar[int]
    relative_path: str
    object_key: str
    presigned_put_url: str
    required_headers: _containers.ScalarMap[str, str]
    def __init__(self, relative_path: _Optional[str] = ..., object_key: _Optional[str] = ..., presigned_put_url: _Optional[str] = ..., required_headers: _Optional[_Mapping[str, str]] = ...) -> None: ...

class CreateDeployUploadSessionRequest(_message.Message):
    __slots__ = ("scenario_id", "files")
    SCENARIO_ID_FIELD_NUMBER: _ClassVar[int]
    FILES_FIELD_NUMBER: _ClassVar[int]
    scenario_id: str
    files: _containers.RepeatedCompositeFieldContainer[_spec_pb2.DeclaredFile]
    def __init__(self, scenario_id: _Optional[str] = ..., files: _Optional[_Iterable[_Union[_spec_pb2.DeclaredFile, _Mapping]]] = ...) -> None: ...

class CreateDeployUploadSessionResponse(_message.Message):
    __slots__ = ("deploy_id", "object_key_prefix", "upload_targets")
    DEPLOY_ID_FIELD_NUMBER: _ClassVar[int]
    OBJECT_KEY_PREFIX_FIELD_NUMBER: _ClassVar[int]
    UPLOAD_TARGETS_FIELD_NUMBER: _ClassVar[int]
    deploy_id: str
    object_key_prefix: str
    upload_targets: _containers.RepeatedCompositeFieldContainer[FileUploadTarget]
    def __init__(self, deploy_id: _Optional[str] = ..., object_key_prefix: _Optional[str] = ..., upload_targets: _Optional[_Iterable[_Union[FileUploadTarget, _Mapping]]] = ...) -> None: ...

class CompleteDeployUploadSessionRequest(_message.Message):
    __slots__ = ("deploy_id",)
    DEPLOY_ID_FIELD_NUMBER: _ClassVar[int]
    deploy_id: str
    def __init__(self, deploy_id: _Optional[str] = ...) -> None: ...
