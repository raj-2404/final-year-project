use std::process::{Child, ChildStdin};
use std::sync::{Arc, Mutex};

pub struct TestProcess {
    pub child: Option<Child>,
    pub stdin: Arc<Mutex<Option<ChildStdin>>>,
}
