package shadow.build.closure;

import com.google.javascript.jscomp.*;
import com.google.javascript.jscomp.Compiler;
import com.google.javascript.rhino.IR;
import com.google.javascript.rhino.Node;
import com.google.javascript.rhino.StaticSourceFile;
import com.google.javascript.rhino.Token;

import java.util.*;

public class ShadowESMExports extends NodeTraversal.AbstractPostOrderCallback implements CompilerPass {

    private final AbstractCompiler compiler;

    public ShadowESMExports(AbstractCompiler compiler) {
        this.compiler = compiler;
    }

    @Override
    public void visit(NodeTraversal t, Node node, Node parent) {
        if (NodeUtil.isCallTo(node, "shadow$export")) {
            Node scope = parent.getParent();

            String name = node.getChildAtIndex(1).getString();
            Node code = node.getChildAtIndex(2).detach();
            Node replacement = new Node(Token.EXPORT);

            if ("default".equals(name)) {
                // export default X;
                replacement.putBooleanProp(Node.EXPORT_DEFAULT, true);
                replacement.addChildToFront(code);
            } else {
                // export let name = X;
                Node let = new Node(Token.LET);
                Node letName = IR.name(name);
                letName.addChildToFront(code);
                let.addChildToFront(letName);
                replacement.addChildToFront(let);
            }

            // replace EXPR_RESULT -> CALL with just EXPORT LET;
            parent.replaceWith(replacement);

            compiler.reportChangeToEnclosingScope(scope);
        }
    }

    @Override
    public void process(Node externs, Node root) {
        NodeTraversal.traverse(compiler, root, this);
    }


    public static void main(String... args) {
        Compiler cc = new Compiler();


        CompilerOptions co = new CompilerOptions();
        co.setLanguageIn(CompilerOptions.LanguageMode.ECMASCRIPT_2017);
        co.setPrettyPrint(true);
        co.setChunkOutputType(CompilerOptions.ChunkOutputType.ES_MODULES);
        co.setEmitUseStrict(false);
        co.setLanguageIn(CompilerOptions.LanguageMode.UNSTABLE);
        co.setLanguageOut(CompilerOptions.LanguageMode.ECMASCRIPT_2021);
        CompilationLevel.ADVANCED_OPTIMIZATIONS.setOptionsForCompilationLevel(co);

        cc.initOptions(co);

        SourceFile testFile = SourceFile.fromCode( "test.js", "export let foo = 1; export default 2; hello();");

        JsAst ast = new JsAst(testFile);
        Node node = ast.getAstRoot(cc);

        System.out.println(node.toStringTree());

        /*
        co.addCustomPass(CustomPassExecutionTime.AFTER_OPTIMIZATION_LOOP, new ShadowESMExports(cc));

         */


        // SourceFile srcFile = SourceFile.fromFile("node_modules/@firebase/util/dist/cjs/src/crypt.js");
        SourceFile srcFile = SourceFile.fromCode("test.js", "shadow$export(\"foo\", 1 + 2); shadow$export(\"default\", 3);", StaticSourceFile.SourceKind.STRONG);
        cc.compile(SourceFile.fromCode("externs.js", "var shadow$export = function(a, b) {};"), srcFile, co);

        ShadowESMExports pass = new ShadowESMExports(cc);

        pass.process(cc.getRoot().getFirstChild(), cc.getRoot().getSecondChild());

        System.out.println(cc.toSource());
    }
}