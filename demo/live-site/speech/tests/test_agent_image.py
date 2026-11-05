"""The agent image copies a fixed list of files (deploy/agent.Dockerfile). A module agent.py imports from this folder that is
not on that list builds nothing: `python agent.py download-files` fails with ModuleNotFoundError, the Komodo deploy fails every
three minutes, and nothing else ships until it is fixed (speech_errors.py, 2026-11-05, #146). This reads the imports, follows them
through the other local modules, and fails when one is missing from the COPY line."""
import ast, os, re, unittest

SPEECH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DOCKERFILE = os.path.join(SPEECH, '..', '..', '..', 'deploy', 'agent.Dockerfile')
LOCAL = {f[:-3] for f in os.listdir(SPEECH) if f.endswith('.py')}


def local_imports(module: str) -> set[str]:
    tree = ast.parse(open(os.path.join(SPEECH, module + '.py'), encoding='utf-8').read())
    found = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found |= {a.name.split('.')[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            found.add(node.module.split('.')[0])
    return found & LOCAL - {module}


def needed_by_agent() -> set[str]:
    seen, todo = {'agent'}, ['agent']
    while todo:
        for dep in local_imports(todo.pop()):
            if dep not in seen:
                seen.add(dep)
                todo.append(dep)
    return seen


class AgentImageTest(unittest.TestCase):
    def test_every_module_the_agent_imports_is_copied_into_the_image(self):
        copied = {m[:-3] for line in open(DOCKERFILE, encoding='utf-8') if line.startswith('COPY ')
                  for m in re.findall(r'demo/live-site/speech/(\w+\.py)', line)}
        missing = sorted(needed_by_agent() - copied)
        self.assertEqual(missing, [], f'agent.py needs {missing}, which deploy/agent.Dockerfile does not COPY')


if __name__ == '__main__':
    unittest.main()
