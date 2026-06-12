from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from typing import ClassVar as _ClassVar

DESCRIPTOR: _descriptor.FileDescriptor

class DeployState(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    deploy_state_unspecified: _ClassVar[DeployState]
    pending_upload: _ClassVar[DeployState]
    uploaded: _ClassVar[DeployState]
    scanning: _ClassVar[DeployState]
    active: _ClassVar[DeployState]
    disabled_abuse: _ClassVar[DeployState]
    deleted: _ClassVar[DeployState]
deploy_state_unspecified: DeployState
pending_upload: DeployState
uploaded: DeployState
scanning: DeployState
active: DeployState
disabled_abuse: DeployState
deleted: DeployState
